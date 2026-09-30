/**
 * Suri en het donker - the story about being scared at bedtime, on the shared stage (`stage.ts`).
 *
 * The script is in `donkerscript.ts`, and its header says what is said aloud and why it is honest.
 * What is particular to this story is here: one bedroom, all the way round the camera, that gets
 * lighter as the story goes on. Night is dim, not black (`donkerart.tones`), so there is always
 * something to look at; the lamp and then the night light change the colours of the whole room.
 *
 * Unlike the other stories this is not a world with a ground and a sky, so it does not use
 * `drawBackdrop`: `drawScene` paints the room itself, turning with the stage's yaw, and the stage's
 * "find the animal" mechanism is borrowed for finding the coat and the window. Each beast is only a
 * point in the circle that the stage watches for being looked at; the room draws the real things.
 *
 * The chapters and what the child does in them:
 *   bedtijd  tap Suri to sit with him
 *   schaduw  turn to find the coat, tap the lamp, the shape becomes a coat
 *   geluid   turn to find the window, drag it shut
 *   ademen   hold a finger on a circle while it grows, let go while it shrinks, three times
 *   lichtje  tap one of three night lights
 *   slapen   nothing: goodnight
 * Nothing can be failed. A breath that was not quite held simply does not count and the circle waits
 * for the next touch; nothing times out, and nothing in the room ever turns out to be a monster.
 */

import { NL, T } from '../util/lang';
import { isSpeaking } from '../platform/voice';
import { handCursor, outlinedText } from '../render/look';
import { ASIDES, BREATHS, BREATH_IN, BREATH_OUT, CHAPTERS, HOLD_SHARE, LIGHTS, type Chapter } from './donkerscript';
import { TAU, wrapAngle } from './look';
import { EYE, makeView, type Palette, type View } from './world';
import {
  bedSpots, chairSpot, drawBed, drawBreathCircle, drawBreathCount, drawChair, drawCoatShadow, drawGlow, drawLamp, drawNightLight,
  drawNightstand, drawPicture, drawRoomBack, drawToyBox, drawWindow, nightstandTop, tones, windowRect, type SuriInBed,
} from './donkerart';
import { bed, donkerSfx, type Bed } from './donkersfx';
import { Stage, type Beast, type Pt } from './stage';

/** Where things stand round the camera, as angles (radians, world). The bed is where you start. */
const A = { bed: -0.14, table: 0.27, shadow: 0.02, window: 1.9, chair: -2.2, picture: -0.95, toys: 3.05, pictureB: -3.0 };

/** The palette is never used (the room paints itself), but the stage wants one. */
const UNUSED: Palette = {
  skyTop: '#000', skyLow: '#000', sun: '#fff', sunAt: 0, sunUp: 0, cloud: '#000', clouds: 0,
  far: '#000', mid: '#000', ground: '#000', groundNear: '#000', haze: '#000', space: true,
};

type Phase = 'rest' | 'in' | 'out';

export class Donker extends Stage {
  protected readonly id = 'donker';
  protected readonly chapters: Chapter[] = CHAPTERS;
  protected readonly title = { en: 'Suri and the dark', nl: 'Suri en het donker' };
  protected readonly lookAround = ASIDES.lookAround;

  // the room
  private lampT = 0; private lampK = 0;
  private glowT = 0; private glowK = 0;
  private scareT = 0; private scareK = 0;
  private tightT = 1; private tightK = 1;
  private winT = 0; private winK = 0;
  private chosen = -1;

  // Suri
  private suri: SuriInBed = 'hide';
  private worry = 1;

  // the child's hands
  private winDrag: { y0: number; open0: number } | null = null;
  private idleT = 0;
  private nagged = false;
  private creakT = 0;
  private rattleT = 0;
  private sat = false;

  // breathing
  private phase: Phase = 'rest';
  private phaseT = 0;
  private holding = false;
  private heldIn = 0;
  private heldOut = 0;
  private breaths = 0;
  private missed = 0;
  private breathK = 0;

  private playing: Bed | null = null;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.run();
  }

  // ---------------------------------------------------------------- layout

  /** Everything is sized from these, so one phone turned on its side gets the same room. */
  private lay(): { f: number; S: number; wallY: number; feetY: number; u: number } {
    const f = makeView(this.w, this.h, 0).f;
    return { f, S: Math.min(f, this.h * 0.66), wallY: this.h * 0.6, feetY: this.h * 0.72, u: this.u() };
  }

  /** Screen x of a direction in the room, at the camera's present yaw. */
  private sx(a: number): number {
    const f = makeView(this.w, this.h, 0).f;
    return this.w / 2 + wrapAngle(a - this.look.yaw) * f;
  }

  private lightTint(): string { return LIGHTS[Math.max(0, this.chosen)].colour; }

  private circle(): { x: number; y: number; rMin: number; rMax: number } {
    const w = this.w, h = this.h;
    if (w > h) { const r = Math.min(h * 0.3, w * 0.15); return { x: w * 0.68, y: h * 0.42, rMin: r * 0.4, rMax: r }; }
    const r = Math.min(w * 0.3, h * 0.17);
    return { x: w / 2, y: h * 0.28, rMin: r * 0.4, rMax: r };
  }

  /** The row where a button sits: over the words at the bottom, in the middle or on the right. */
  private row(bw: number, bh: number): { x: number; y: number } {
    const u = this.u();
    const y = this.h - 14 * u - (22 * u + 3 * 17 * u) - 10 * u - bh;
    return { x: this.w > this.h ? this.w - bw - 14 * u : (this.w - bw) / 2, y };
  }

  private lampButton(): { x: number; y: number; w: number; h: number } {
    const u = this.u(), bw = Math.min(200 * u, this.w - 90 * u), bh = 54 * u;
    return { ...this.row(bw, bh), w: bw, h: bh };
  }

  private lightPads(): Array<{ x: number; y: number; w: number; h: number }> {
    const u = this.u(), pw = 76 * u, ph = 84 * u, gap = 10 * u;
    const total = pw * 3 + gap * 2;
    const r = this.row(total, ph);
    return [0, 1, 2].map(i => ({ x: r.x + i * (pw + gap), y: r.y, w: pw, h: ph }));
  }

  // ---------------------------------------------------------------- debug

  protected debugExtra(): Record<string, unknown> {
    const L = this.lay();
    const b = bedSpots(this.sx(A.bed), L.feetY, L.S);
    const wr = windowRect(this.sx(A.window), L.feetY, L.S);
    const c = this.circle();
    const top = nightstandTop(this.sx(A.table), L.feetY, L.S);
    return {
      suri: this.suri, lamp: this.lampT, lampK: Math.round(this.lampK * 100) / 100, scare: Math.round(this.scareK * 100) / 100,
      tight: Math.round(this.tightK * 100) / 100, winOpen: Math.round(this.winK * 100) / 100, glow: this.glowT, chosen: this.chosen,
      phase: this.phase, holding: this.holding, breaths: this.breaths, breathK: Math.round(this.breathK * 100) / 100,
      spots: {
        suri: { x: Math.round(b.head.x), y: Math.round(b.head.y) },
        lamp: { x: Math.round(top.x - 0.03 * L.S), y: Math.round(top.y - 0.11 * L.S) },
        window: { x: Math.round(wr.x + wr.w / 2), y: Math.round(wr.y + wr.h * 0.6), w: Math.round(wr.w), h: Math.round(wr.h) },
        circle: { x: Math.round(c.x), y: Math.round(c.y), r: Math.round(c.rMax) },
      },
    };
  }

  // ---------------------------------------------------------------- chapters and cues

  protected palette(): Palette { return UNUSED; }
  protected drawBeast(_v: View, _b: Beast): void { /* the room draws the coat and the window itself */ }

  protected setup(c: Chapter): void {
    this.props = []; this.beast = null; this.life = null;
    this.idleT = 0; this.nagged = false; this.creakT = 2.5; this.rattleT = 0;
    this.winDrag = null; this.holding = false;
    this.phase = 'rest'; this.phaseT = 0; this.heldIn = 0; this.heldOut = 0; this.breaths = 0; this.missed = 0; this.breathK = 0;
    this.lampT = 0; this.glowT = 0; this.scareT = 0; this.winT = 0;
    this.suri = 'peek'; this.worry = 0.7; this.tightT = 0.6;
    if (c.id === 'bedtijd') { this.suri = 'hide'; this.worry = 1; this.tightT = 1; this.chosen = -1; this.sat = false; }
    else if (c.id === 'schaduw') { this.scareT = 1; this.worry = 0.85; this.tightT = 0.8; this.placeBeast('coat'); }
    else if (c.id === 'geluid') { this.winT = 0.55; this.worry = 0.7; this.tightT = 0.5; this.placeBeast('wind'); }
    else if (c.id === 'ademen') { this.suri = 'sit'; this.tightT = 0.4; }
    else if (c.id === 'lichtje') { this.suri = 'sit'; this.tightT = 0.2; }
    else if (c.id === 'slapen') {
      if (this.chosen < 0) this.chosen = 0;
      this.glowT = 1; this.worry = 0.2; this.tightT = 0.1;
    }
    // each scene starts as it is, not on its way to it
    this.lampK = this.lampT; this.glowK = this.glowT; this.scareK = this.scareT; this.tightK = this.tightT; this.winK = this.winT;
  }

  /** The coat or the window, as a point in the circle round the camera that the stage can watch. */
  private placeBeast(kind: 'coat' | 'wind'): void {
    const a = kind === 'coat' ? A.chair : A.window;
    const dist = 2;
    this.beast = { kind, x: Math.sin(a) * dist, z: Math.cos(a) * dist, speed: 0, heading: 0, phase: 0, stride: 1, head: 0, jaw: 0, lift: 0 };
    this.aimBeast();
  }

  /** The stage works out where the beast is on screen from a height above the ground; give it the room's. */
  private aimBeast(): void {
    const b = this.beast;
    if (!b) return;
    const L = this.lay();
    const y = b.kind === 'coat' ? chairSpot(0, L.feetY, L.S).y : windowRect(0, L.feetY, L.S).y + windowRect(0, L.feetY, L.S).h / 2;
    const dist = Math.hypot(b.x, b.z);
    b.lift = EYE - ((y - this.h * 0.5) * dist) / L.f;
  }

  protected cue(name: string): void {
    if (name === 'sit') { this.suri = 'peek'; this.worry = 0.5; this.tightT = 0.85; }
    else if (name === 'lampOff') { this.lampT = 0; this.tightT = 0.5; }
    else if (name === 'creak') { donkerSfx.creak(); this.rattleT = 1; }
    else if (name === 'glow') {
      this.glowT = 1; donkerSfx.glow(); this.tightT = 0.12;
      this.ps.spawn('spark', this.sx(A.table) + 0.045 * this.lay().S, this.lay().feetY - 0.24 * this.lay().S, 10,
        { colour: this.lightTint(), speed: 70, size: 5 * this.u(), max: 1.1, grav: -10, spread: TAU });
    } else if (name === 'goodnight') {
      this.suri = 'sleep'; this.worry = 0; this.tightT = 0.1; donkerSfx.goodnight();
      const L = this.lay(), hd = bedSpots(this.sx(A.bed), L.feetY, L.S).head;
      this.ps.spawn('heart', hd.x, hd.y - 0.08 * L.S, 5, { colour: '#ffb3cf', speed: 40, size: 14 * this.u(), max: 2.2, grav: -25, spread: 1.2 });
    } else if (name === 'end') { this.finished = true; this.markSeen(); }
  }

  protected ambience(): void {
    if (!this.started) return;
    const want: Bed = this.chapterId() === 'geluid' && this.winT > 0.04 ? 'wind' : this.glowT > 0 ? 'cosy' : 'room';
    if (want === this.playing) return;
    this.playing = want;
    bed(want);
  }

  destroy(): void { super.destroy(); bed(null); }

  protected onFound(b: Beast): void {
    donkerSfx.found();
    this.turnTo(b.kind === 'coat' ? A.chair : A.window, 1.3);
    this.idleT = 0;
  }

  protected facingOf(): -1 | 1 { return 1; }

  // ---------------------------------------------------------------- per frame

  protected tick(dt: number): void {
    const ease = (k: number, to: number, rate: number): number => k + (to - k) * Math.min(1, dt * rate);
    this.lampK = ease(this.lampK, this.lampT, 4);
    this.glowK = ease(this.glowK, this.glowT, 1.6);
    this.scareK = ease(this.scareK, this.scareT, 2.2);
    this.tightK = ease(this.tightK, this.tightT, 1.2);
    if (!this.winDrag) this.winK = ease(this.winK, this.winT, 5);
    this.rattleT = Math.max(0, this.rattleT - dt);
    this.aimBeast();
    const w = this.waiting();

    // the sound comes round again now and then until it has been found, softly
    if (this.chapterId() === 'geluid' && w === 'found') {
      this.creakT += dt;
      if (this.creakT > 7) { this.creakT = 0; donkerSfx.creak(); this.rattleT = 1; }
    }

    if (w === 'sat') this.nudge(dt, ASIDES.tapSuri);
    else if (w === 'lamp') this.nudge(dt, ASIDES.tapLamp);
    else if (w === 'closed') this.nudge(dt, ASIDES.drag);
    else if (w === 'chosen') this.nudge(dt, ASIDES.choose);

    if (this.chapterId() === 'ademen') this.breathe(dt, w === 'breathed');
    this.ambience();
  }

  /** Nothing happening for a while on a step that needs the child: say how, once. */
  private nudge(dt: number, a: { say: string; sayNl: string }): void {
    this.idleT += dt;
    if (this.idleT > 9 && !this.nagged && !isSpeaking()) { this.nagged = true; this.aside(a); }
  }

  /**
   * The breathing circle. It rests until a finger touches it, then grows for BREATH_IN seconds and
   * shrinks for BREATH_OUT whether or not the finger stays. A breath counts when the finger was on
   * it for most of the growing and mostly off it while it shrank; one that did not count is not
   * a mistake, the circle just waits for the next touch.
   */
  private breathe(dt: number, active: boolean): void {
    if (!active) { this.breathK -= this.breathK * Math.min(1, dt * 3); return; }
    if (this.phase === 'rest') {
      this.breathK += (0 - this.breathK) * Math.min(1, dt * 3);
      return;
    }
    this.phaseT += dt;
    if (this.phase === 'in') {
      if (this.holding) this.heldIn += dt;
      const p = Math.min(1, this.phaseT / BREATH_IN);
      this.breathK = p * p * (3 - 2 * p);
      if (this.phaseT >= BREATH_IN) { this.phase = 'out'; this.phaseT = 0; this.aside(ASIDES.breathOut); donkerSfx.breathOut(); }
    } else {
      if (this.holding) this.heldOut += dt;
      const p = Math.min(1, this.phaseT / BREATH_OUT);
      this.breathK = 1 - p * p * (3 - 2 * p);
      if (this.phaseT >= BREATH_OUT) this.endBreath();
    }
  }

  private endBreath(): void {
    const counted = this.heldIn >= BREATH_IN * HOLD_SHARE && this.heldOut <= BREATH_OUT * (1 - HOLD_SHARE);
    this.phase = 'rest'; this.phaseT = 0; this.breathK = 0;
    if (counted) {
      this.breaths++;
      this.missed = 0;
      const c = this.circle();
      this.ps.spawn('spark', c.x, c.y, 10, { colour: '#fff3b0', speed: 90, size: 5 * this.u(), max: 1, grav: -20, spread: TAU });
      if (this.breaths >= BREATHS) this.flags.add('breathed');
      else this.tightT = Math.max(0.2, this.tightT - 0.08);
    } else if (++this.missed >= 1 && !isSpeaking()) {
      this.aside(ASIDES.hold);
    }
    if (this.breaths >= BREATHS) this.tightT = 0.2;
  }

  // ---------------------------------------------------------------- the child's hands

  protected down(p: Pt): boolean {
    const id = this.chapterId(), L = this.lay();
    this.idleT = 0;

    if (id === 'bedtijd') {
      const b = bedSpots(this.sx(A.bed), L.feetY, L.S);
      if (p.x > b.x0 - 0.05 * L.S && p.x < b.x0 + b.w + 0.05 * L.S && p.y > L.feetY - 0.45 * L.S && p.y < L.feetY + 0.02 * L.S) {
        if (!this.sat) { this.sat = true; this.flags.add('sat'); donkerSfx.sit(); }
        this.ps.spawn('heart', b.head.x, b.head.y - 0.06 * L.S, 3, { colour: '#ffb3cf', speed: 40, size: 12 * this.u(), max: 1.6, grav: -25, spread: 1.2 });
      }
      return true;
    }

    if (id === 'schaduw') {
      if (this.flags.has('found') && !this.flags.has('lamp')) {
        const top = nightstandTop(this.sx(A.table), L.feetY, L.S);
        if (Math.hypot(p.x - (top.x - 0.03 * L.S), p.y - (top.y - 0.11 * L.S)) < 0.16 * L.S) { this.lampOn(); return true; }
      }
      return false;
    }

    if (id === 'geluid') {
      if (this.flags.has('found') && !this.flags.has('closed')) {
        const r = windowRect(this.sx(A.window), L.feetY, L.S), m = 0.06 * L.S;
        if (p.x > r.x - m && p.x < r.x + r.w + m && p.y > r.y - m && p.y < r.y + r.h + m) { this.winDrag = { y0: p.y, open0: this.winK }; return true; }
      }
      return false;
    }

    if (id === 'ademen') {
      const c = this.circle();
      if (Math.hypot(p.x - c.x, p.y - c.y) < c.rMax * 1.25) {
        this.holding = true;
        if (this.waiting() === 'breathed' && this.phase === 'rest') {
          this.phase = 'in'; this.phaseT = 0; this.heldIn = 0; this.heldOut = 0;
          this.aside(ASIDES.breathIn); donkerSfx.breathIn();
        }
      }
      return true;
    }

    if (id === 'lichtje') {
      this.lightPads().forEach((r, i) => {
        if (this.glowT === 0 && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) this.choose(i);
      });
      return true;
    }
    // the last chapter and its goodbye: the camera stays put
    return id === 'slapen';
  }

  protected drag(p: Pt): boolean {
    if (!this.winDrag) return false;
    const S = this.lay().S;
    // a short pull down shuts it: a finger's worth, not the whole height of the window
    const open = Math.max(0, Math.min(1, this.winDrag.open0 * (1 - (p.y - this.winDrag.y0) / (0.2 * S))));
    this.winK = open; this.winT = open;
    if (open < 0.04) { this.winDrag = null; this.closeWindow(); }
    return true;
  }

  protected release(): void {
    this.holding = false;
    if (this.winDrag) {
      this.winDrag = null;
      if (this.winK < 0.25) this.closeWindow();
    }
  }

  protected press(id: string): void {
    if (id === 'lamp') { this.lampOn(); return; }
    if (id.startsWith('light-')) { this.choose(LIGHTS.findIndex(l => l.id === id.slice(6))); return; }
    super.press(id);
  }

  private lampOn(): void {
    if (this.flags.has('lamp')) return;
    this.flags.add('lamp');
    this.lampT = 1; this.scareT = 0; this.tightT = 0.55;
    donkerSfx.lamp();
  }

  private closeWindow(): void {
    if (this.flags.has('closed')) return;
    this.flags.add('closed');
    this.winT = 0;
    donkerSfx.close();
    this.tightT = 0.4;
  }

  private choose(i: number): void {
    if (i < 0 || this.flags.has('chosen')) return;
    this.chosen = i;
    this.flags.add('chosen');
    donkerSfx.found();
  }

  // ---------------------------------------------------------------- drawing

  protected drawScene(): boolean {
    const ctx = this.ctx, w = this.w, h = this.h;
    const { f, S, wallY, feetY } = this.lay();
    const yaw = this.look.yaw;
    const tn = tones({ lamp: this.lampK, glow: this.glowK, tint: this.lightTint() });
    const margin = 0.6 * S;
    const seen = (a: number): boolean => { const x = this.sx(a); return x > -margin && x < w + margin; };
    const talking = isSpeaking() ? 0.5 + 0.5 * Math.sin(this.t * 12) : 0;

    drawRoomBack(ctx, w, h, yaw, f, wallY, tn);

    // moonlight from the window across the floor, fainter the lighter the room is
    if (seen(A.window)) {
      const wx = this.sx(A.window);
      ctx.fillStyle = `rgba(200, 215, 255, ${0.08 * (1 - this.lampK)})`;
      ctx.beginPath(); ctx.moveTo(wx - 0.14 * S, wallY); ctx.lineTo(wx + 0.14 * S, wallY); ctx.lineTo(wx + 0.5 * S, h); ctx.lineTo(wx - 0.1 * S, h); ctx.closePath(); ctx.fill();
    }

    if (seen(A.picture)) drawPicture(ctx, this.sx(A.picture), wallY * 0.42, S, tn);
    if (seen(A.pictureB)) drawPicture(ctx, this.sx(A.pictureB), wallY * 0.42, S, tn);
    if (seen(A.toys)) drawToyBox(ctx, this.sx(A.toys), feetY, S, tn);
    if (seen(A.window)) {
      drawWindow(ctx, this.sx(A.window), feetY, S, this.winK + (this.rattleT > 0 ? Math.sin(this.t * 40) * 0.012 * this.rattleT : 0), tn, this.t);
      // until the child has done it once: a hand that shows the pull down
      if (this.chapterId() === 'geluid' && this.flags.has('found') && !this.flags.has('closed') && !this.winDrag) {
        const r = windowRect(this.sx(A.window), feetY, S), k = (this.t * 0.7) % 1;
        handCursor(ctx, r.x + r.w / 2, r.y + r.h * (0.3 + 0.35 * k), 0.05 * S, 1);
      }
    }

    // the shadow on the wall, from the same coat that hangs on the chair
    if (this.chapterId() !== 'bedtijd' && this.chapterId() !== 'ademen' && !this.finished && seen(A.shadow)) {
      const alpha = 0.58 - 0.3 * this.lampK - 0.1 * this.glowK;
      drawCoatShadow(ctx, this.sx(A.shadow), wallY * 0.1, S * 0.32, this.scareK, Math.max(0.15, alpha));
    }

    if (seen(A.chair)) {
      const cx = this.sx(A.chair);
      drawChair(ctx, cx, feetY, S, tn);
      if (this.flags.has('found') && this.chapterId() === 'schaduw' && !this.flags.has('lamp')) {
        const cs = chairSpot(cx, feetY, S);
        ctx.strokeStyle = `rgba(255, 240, 180, ${0.45 + 0.3 * Math.sin(this.t * 4)})`; ctx.lineWidth = 3 * this.u();
        ctx.beginPath(); ctx.ellipse(cs.x, cs.y, 0.2 * S, 0.27 * S, 0, 0, TAU); ctx.stroke();
      }
    }

    if (seen(A.table)) {
      const tx = this.sx(A.table), top = nightstandTop(tx, feetY, S);
      drawNightstand(ctx, tx, feetY, S, tn);
      const shade = drawLamp(ctx, top.x - 0.03 * S, top.y, S, this.lampK, tn);
      drawGlow(ctx, shade.x, shade.y, 1.1 * S, '#ffe2a0', 0.6 * this.lampK);
      const place = this.chosen >= 0 && (this.chapterId() === 'slapen' || this.flags.has('chosen'));
      if (place) drawNightLight(ctx, top.x + 0.05 * S, top.y - 0.004 * S, 0.07 * S, this.lightTint(), this.glowK);
      if (this.chapterId() === 'schaduw' && this.flags.has('found') && !this.flags.has('lamp')) {
        ctx.strokeStyle = `rgba(255, 240, 180, ${0.5 + 0.3 * Math.sin(this.t * 4)})`; ctx.lineWidth = 3 * this.u();
        ctx.beginPath(); ctx.arc(shade.x, shade.y, 0.1 * S + Math.sin(this.t * 4) * 2, 0, TAU); ctx.stroke();
      }
    }

    if (seen(A.bed)) {
      const bx = this.sx(A.bed);
      drawBed(ctx, bx, feetY, S, tn, this.suri, this.worry, this.t, talking);
      this.drawAche(bx, feetY, S);
      if (this.chapterId() === 'bedtijd' && !this.sat && this.started) {
        const hd = bedSpots(bx, feetY, S).head;
        handCursor(ctx, hd.x + 0.1 * S, hd.y + 0.04 * S + Math.sin(this.t * 4) * 4, 0.05 * S, 0.5 + 0.5 * Math.sin(this.t * 4));
      }
    }

    // the room is dark at night, and a little darker round the edges, so the light has somewhere to be
    ctx.fillStyle = `rgba(8, 10, 30, ${0.12 * (1 - this.lampK)})`;
    ctx.fillRect(0, 0, w, h);

    if (this.chapterId() === 'ademen') this.drawBreathing();
    this.drawArrow();
    return true;
  }

  /** The tight tummy: a wobbly amber line over Suri, smaller as the night goes on. */
  private drawAche(bx: number, feetY: number, S: number): void {
    if (this.tightK < 0.05 || this.suri === 'sleep') return;
    const ctx = this.ctx, u = this.u(), b = bedSpots(bx, feetY, S);
    const x = b.x0 + (this.suri === 'sit' ? 0.36 : 0.27) * S, y = b.yM - (this.suri === 'sit' ? 0.14 : 0.1) * S;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 210, 120, ${(0.3 + 0.4 * Math.sin(this.t * 3)) * this.tightK + 0.25 * this.tightK})`;
    ctx.lineWidth = 3 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    const n = 7, step = 0.012 * S * (0.4 + 0.6 * this.tightK), amp = 0.012 * S * (0.4 + 0.6 * this.tightK);
    for (let i = 0; i <= n; i++) { const px = x + i * step, py = y + (i % 2 ? -amp : amp); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
    ctx.stroke();
    ctx.restore();
  }

  private drawBreathing(): void {
    const ctx = this.ctx, u = this.u(), c = this.circle();
    const rest = this.phase === 'rest' ? 0.05 * (0.5 + 0.5 * Math.sin(this.t * 2)) : 0;
    drawBreathCircle(ctx, c.x, c.y, c.rMin, c.rMax, Math.max(this.breathK, rest), this.holding, this.t);
    drawBreathCount(ctx, c.x, c.y - c.rMax * 1.08 - 18 * u, 7 * u, this.breaths, BREATHS);
    if (this.waiting() === 'breathed') {
      const label = this.phase === 'in' ? T('Breathe in', 'Adem in') : this.phase === 'out' ? T('and out', 'en uit') : '';
      if (label) { ctx.textAlign = 'center'; outlinedText(ctx, label, c.x, c.y + 6 * u, this.font('900', 17), '#1d2a5a', 'rgba(255, 255, 255, 0.85)', 5); }
      if (this.phase === 'rest' && !this.holding) handCursor(ctx, c.x + c.rMax * 0.1, c.y + c.rMax * 0.1, c.rMax * 0.3, 0.5 + 0.5 * Math.sin(this.t * 3));
    }
  }

  /** The arrow at the screen's edge pointing the short way round to what is being looked for. */
  private drawArrow(): void {
    if (this.waiting() !== 'found' || !this.beast || this.lostT <= 3.5 || this.beastScreen().on) return;
    const ctx = this.ctx, u = this.u();
    const left = wrapAngle(Math.atan2(this.beast.x, this.beast.z) - this.look.yaw) < 0;
    const x = left ? 26 * u : this.w - 26 * u, y = this.h * 0.4;
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.t * 5);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x + (left ? -12 : 12) * u, y); ctx.lineTo(x + (left ? 10 : -10) * u, y - 16 * u); ctx.lineTo(x + (left ? 10 : -10) * u, y + 16 * u);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  protected drawUi(): void {
    const ctx = this.ctx, u = this.u();
    // the chapter's name, since this story does not go through the stage's own world drawing
    if (this.titleT > 0) {
      const c = this.chapters[this.place.chapter];
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.titleT);
      ctx.textAlign = 'center';
      outlinedText(ctx, NL() ? c.titleNl : c.title, this.w / 2, 40 * u, this.font('900', 20), '#ffffff', 'rgba(20, 30, 70, 0.85)', 6);
      ctx.restore();
    }
    const id = this.chapterId();
    if (id === 'schaduw' && this.flags.has('found') && !this.flags.has('lamp')) {
      const b = this.lampButton();
      this.button('lamp', T('Lamp on', 'Lampje aan'), b.x, b.y, b.w, b.h, '#f2c14e', '#25506e');
    }
    if (id === 'lichtje' && this.glowT === 0) {
      this.lightPads().forEach((r, i) => {
        const l = LIGHTS[i];
        this.button(`light-${l.id}`, '', r.x, r.y, r.w, r.h, l.colour, '#123047');
        drawNightLight(ctx, r.x + r.w / 2, r.y + r.h * 0.66, r.h * 0.42, l.colour, 0.6);
        ctx.fillStyle = '#123047'; ctx.font = this.font('900', 13); ctx.textAlign = 'center';
        ctx.fillText(NL() ? l.nl : l.en, r.x + r.w / 2, r.y + r.h * 0.88);
        if (this.chosen === i) {
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4 * u;
          ctx.beginPath(); ctx.roundRect(r.x - 3 * u, r.y - 3 * u, r.w + 6 * u, r.h + 6 * u, r.h * 0.34); ctx.stroke();
        }
      });
    }
  }
}
