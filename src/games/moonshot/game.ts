/**
 * Moonshot - the ninth game in Bramblewood.
 *
 * Build a rocket out of parts, decide for yourself when it is finished, and fly the thing you
 * built. The build screen asks one question the whole time: is the push bigger than the weight?
 * The flight answers a second one: how fast were you going when the fuel ran out? Everything else
 * - the staging, the thinning air, the gravity turn - is in service of those two.
 *
 * Passing a milestone hands you the next part, so the rocket that reached the clouds is what buys
 * the tank that reaches the aeroplanes. There is no other currency and nothing to wait for.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { uiScale, safeArea } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { persist, save } from '../../util/storage';
import {
  bleedEdges, chunkyButton, drawStar, easeOutBack, glassPanel, handCursor, heading,
  outlinedText, Particles, Shake, vignette,
} from '../../render/look';
import {
  airAt, canLift, gravityAt, isFlyable, kmLabel, LADDER, liftThrust, MAX_PARTS, nextRung, padWeight,
  PARTS, partById, rungFor, stagesOf, totalMass, coastHeight,
  type Part, type Stack, type Stage,
} from './model';
import {
  paintCloud, paintEarthBelow, paintFlame, paintGrain, paintPad, paintPart, paintRocket, paintStars,
  paintTower, skyTone, stackHeight,
} from './paint';
import { engineSound, rocket } from './rocketsfx';

type Ctx = CanvasRenderingContext2D;
type Phase = 'build' | 'count' | 'fly' | 'coast' | 'done';

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (p: Part): string => (NL() ? p.nameNl : p.name);

interface Hit { id: string; x: number; y: number; w: number; h: number }

/** A stage that has been let go and is tumbling away below. */
interface Debris { y: number; vy: number; spin: number; a: number; parts: number[]; age: number }

export class Moonshot {
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

  private phase: Phase = 'build';
  private phaseT = 0;
  private stack: Stack = [];
  private hits: Hit[] = [];
  private held: string | null = null;
  private picked = -1;
  private note = '';
  private noteT = 0;

  // the flight
  private stages: Stage[] = [];
  private stageIndex = 0;
  private fuel = 0;
  private dropped = new Set<number>();
  private debris: Debris[] = [];
  private alt = 0;
  private vUp = 0;
  private vSide = 0;
  private tilt = 0;
  private wobble = 0;
  private wind = 0;
  private steer = 0;
  private warp = 1;
  private burnout = 0;
  private topKm = 0;
  private shownKm = 0;
  private countdown = 0;
  private lastTick = 9;
  private result = 0;
  private earnedRung = 0;
  private freshUnlock: string | null = null;
  private idle = 0;

  private ps = new Particles();
  private shake = new Shake();

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointerup', () => this.onUp());
    canvas.addEventListener('pointercancel', () => this.onUp());
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    this.stack = this.remembered();
    (window as unknown as { __moon?: Moonshot }).__moon = this;
    const loop = (ms: number): void => {
      const now = ms / 1000;
      const dt = Math.min(0.05, now - this.t || 0);
      this.t = now;
      this.update(dt);
      this.draw();
      bleedEdges(this.ctx, this.canvas, this.w, this.dpr, this.st, this.sb, this.h);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  debugState(): Record<string, unknown> {
    return {
      phase: this.phase, stack: [...this.stack],
      mass: Math.round(totalMass(this.stack) * 10) / 10,
      thrust: Math.round(liftThrust(this.stack)),
      weight: Math.round(padWeight(this.stack)),
      lifts: canLift(this.stack),
      best: this.best(),
      altKm: Math.round(this.alt / 100) / 10,
      vUp: Math.round(this.vUp),
      stage: this.stageIndex,
      warp: this.warp,
      tilt: Math.round(this.tilt * 100) / 100,
      vSide: Math.round(this.vSide),
      topKm: this.topKm,
      result: this.result,
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }

  // ---------- what the child owns ----------

  private best(): number { return save.moon?.best ?? 0; }
  private remembered(): Stack {
    const s = save.moon?.stack;
    return s && s.length ? s.filter((id: string) => PARTS.some(p => p.id === id)) : ['engine-s', 'tank-s'];
  }
  private unlocked(p: Part): boolean { return this.best() >= p.unlockAt; }
  private remember(): void {
    save.moon = { best: this.best(), stack: [...this.stack] };
    persist();
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

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  /**
   * The bands the build screen is cut into: the balance at the top, the rocket in the middle, the
   * tray and the launch button along the bottom. Everything else reads these rather than guessing.
   */
  /** Everything the child owns, plus the next one along so there is always something to want. */
  private trayList(): Part[] {
    const best = this.best();
    return PARTS.filter(p => p.kind !== 'capsule' && p.unlockAt <= best + 1);
  }

  /**
   * How the tray lays out. A thumb needs a cell it can hit, so once the parts stop fitting across
   * the screen the tray takes a second row rather than squeezing them - which is what a narrow
   * phone does as soon as most of the parts are unlocked.
   */
  private trayGrid(): { cols: number; rows: number } {
    const u = this.u();
    const n = this.trayList().length;
    // 56 real pixels, not scaled ones: what decides whether a part fits is the width of a thumb,
    // which is the same on a tablet as it is on a phone
    const fits = Math.max(3, Math.floor((this.w - 12 * u) / 56));
    const rows = n > fits ? 2 : 1;
    return { cols: Math.ceil(n / rows), rows };
  }

  /**
   * The build screen in four strips: the balance, the rocket, the tray of parts, and Launch.
   *
   * On a landscape phone there is no room to stack the balance above the rocket - doing so leaves
   * the rocket about forty pixels tall - so the balance moves out to the left and the rocket gets
   * the whole height instead.
   */
  private bands(): {
    wide: boolean; scaleX: number; scaleY: number;
    rocketTop: number; rocketBase: number; trayY: number; trayH: number; launchY: number;
  } {
    const u = this.u();
    const wide = this.w > this.h * 1.3;
    const launchH = 50 * u;
    const launchY = this.h - launchH - 8 * u;
    const rows = this.trayGrid().rows;
    const trayH = rows === 2
      ? Math.min(206 * u, this.h * 0.32)
      : Math.min(122 * u, this.h * (wide ? 0.26 : 0.19));
    const trayY = launchY - trayH - 8 * u;
    const scaleY = wide ? 58 * u : 92 * u;
    return {
      wide,
      scaleX: wide ? Math.max(this.w * 0.2, 118 * u) : this.w / 2,
      scaleY,
      rocketTop: wide ? 20 * u : scaleY + 88 * u,
      rocketBase: trayY - (wide ? 10 : 26) * u,
      trayY, trayH, launchY,
    };
  }

  /** How big one rocket unit is drawn, so even a fourteen-part stack fits between the bands. */
  private buildUnit(): number {
    const b = this.bands();
    const room = Math.max(60, b.rocketBase - b.rocketTop);
    const widest = Math.max(1.4, ...this.stack.map(id => partById(id).w * (partById(id).kind === 'booster' ? 3.2 : 1)));
    // in landscape the balance has the left of the screen, so the rocket keeps to the middle third
    return clamp(Math.min(room / Math.max(4, stackHeight(this.stack)), (this.w * (b.wide ? 0.3 : 0.62)) / widest), 7, 96 * this.u());
  }

  // ---------- building ----------

  private add(id: string): void {
    if (this.stack.length >= MAX_PARTS) {
      this.say(T('That is as tall as the crane goes.', 'Hoger komt de kraan niet.'));
      rocket.blocked();
      return;
    }
    const p = partById(id);
    if (!this.unlocked(p)) { rocket.blocked(); this.say(this.lockLine(p)); return; }
    // a part goes on top of the stack, under the capsule, which is where a child expects it
    this.stack = [...this.stack, id];
    this.picked = this.stack.length - 1;
    this.idle = 0;
    rocket.clunk();
    this.remember();
    this.say(`${nameOf(p)} - ${this.tradeLine(p)}`);
  }

  private removeAt(i: number): void {
    if (i < 0 || i >= this.stack.length) return;
    rocket.clunk();
    this.stack = this.stack.filter((_, k) => k !== i);
    this.picked = -1;
    this.idle = 0;
    this.remember();
  }

  /** The one line that says what a part costs you as well as what it gives. */
  private tradeLine(p: Part): string {
    const nl = NL();
    if (p.kind === 'tank') {
      return nl ? `${p.fuel} ton brandstof, en ${p.dry} ton zwaarder leeg.` : `${p.fuel} tonnes of fuel, and ${p.dry} tonnes heavier when empty.`;
    }
    if (p.kind === 'engine' || p.kind === 'booster') {
      const kn = Math.round(p.burn * p.exhaust);
      return nl ? `duwt met ${kn}, weegt ${p.dry} ton.` : `pushes with ${kn}, weighs ${p.dry} tonnes.`;
    }
    if (p.kind === 'fin') return nl ? 'houdt hem recht in de lucht.' : 'keeps it straight while there is air.';
    return nl ? 'waar je in zit.' : 'the bit you sit in.';
  }

  private lockLine(p: Part): string {
    const m = LADDER[p.unlockAt];
    const where = NL() ? m.nameNl : m.name;
    return T(`Reach ${where} first.`, `Kom eerst tot ${where.toLowerCase()}.`);
  }

  private say(text: string, secs = 3.4): void { this.note = text; this.noteT = secs; }

  // ---------- flying ----------

  private launch(): void {
    if (!isFlyable(this.stack)) {
      rocket.blocked();
      this.say(canLift(this.stack)
        ? T('It needs fuel to burn.', 'Er moet brandstof in.')
        : T('Too heavy. More push, or less rocket.', 'Te zwaar. Meer duwkracht, of minder raket.'));
      this.shake.add(0.5);
      return;
    }
    this.stages = stagesOf(this.stack);
    this.stageIndex = 0;
    this.fuel = this.stages[0].fuel;
    this.dropped = new Set();
    this.debris = [];
    this.alt = 0; this.vUp = 0; this.vSide = 0;
    this.tilt = 0; this.wobble = 0; this.wind = 0; this.steer = 0;
    this.warp = 1;
    this.burnout = 0; this.topKm = 0; this.shownKm = 0;
    this.countdown = 3.2; this.lastTick = 9;
    this.result = 0; this.freshUnlock = null;
    this.phase = 'count'; this.phaseT = 0;
    this.ps.clear();
    this.remember();
  }

  private stageNow(): Stage | null { return this.stages[this.stageIndex] ?? null; }

  /** Let the spent stage go: it drops away and the next engine lights. */
  private drop(): void {
    const s = this.stageNow();
    if (!s) return;
    const parts = s.parts.filter(i => !this.dropped.has(i));
    for (const i of parts) this.dropped.add(i);
    this.debris.push({ y: 0, vy: -this.vUp * 0.12 - 8, spin: (Math.random() - 0.5) * 2.2, a: 0, parts, age: 0 });
    this.stageIndex++;
    const next = this.stageNow();
    this.fuel = next ? next.fuel : 0;
    if (next) { rocket.stage(); this.shake.add(0.55); }
    else { rocket.burnout(); this.burnout = this.vUp; }
  }

  private update(dt: number): void {
    this.phaseT += dt;
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.idle += dt;

    if (this.phase === 'count') {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this.lastTick && c > 0) { this.lastTick = c; rocket.tick(); }
      if (this.countdown <= 0) {
        this.phase = 'fly'; this.phaseT = 0; rocket.ignite(); this.shake.add(1);
        engineSound.start();
      }
      return;
    }
    if (this.phase === 'fly') {
      // Warping the burn must not coarsen the integration, or the rocket flies a different flight
      // at 2x than it does at 1x. Take the same small steps, just more of them per frame.
      const steps = Math.max(1, Math.round(this.warp));
      for (let i = 0; i < steps && this.phase === 'fly'; i++) this.flyStep(dt);
      return;
    }
    if (this.phase === 'coast') {
      // the number climbs to wherever the speed was good for, and slows as it gets there
      const k = 1 - Math.pow(0.12, dt * this.warp);
      this.shownKm += (this.topKm - this.shownKm) * k;
      if (this.phaseT > 2.4 && (this.topKm === 0 || this.shownKm > this.topKm * 0.995)) this.finish();
      return;
    }
  }

  private flyStep(dt: number): void {
    const s = this.stageNow();
    const m = this.liveMass() * 1000;
    const g = gravityAt(this.alt);
    const air = airAt(this.alt);

    // steering: the rocket leans the way you hold it, and the air fights the lean
    const fins = this.stack.some((id, i) => partById(id).kind === 'fin' && !this.dropped.has(i));
    const authority = 0.9 + (1 - air) * 0.8;
    this.tilt = clamp(this.tilt + this.steer * authority * dt, -1.2, 1.2);
    // wind and a rocket's own wobble push it off; fins and thick air damp it
    this.wind += (Math.sin(this.t * 0.7) * 0.5 + Math.sin(this.t * 1.9 + 1.3) * 0.5) * dt * 0.35 * air;
    this.wind *= 1 - dt * 0.6;
    const damp = air * (fins ? 2.4 : 0.9);
    this.wobble += (this.wind - this.wobble) * dt * 2;
    this.tilt += this.wobble * dt;
    this.tilt -= this.tilt * damp * dt * 0.55;

    let a = -g;
    let ax = 0;
    if (s && this.fuel > 0) {
      const acc = (s.thrust * 1000) / m;
      a += acc * Math.cos(this.tilt);
      ax += acc * Math.sin(this.tilt);
      const used = Math.min(this.fuel, s.burn * dt);
      this.fuel -= used;
      if (this.alt < 400) this.shake.add(dt * 1.2);
    }
    // the air pushes back, hard and low down
    const speed = Math.hypot(this.vUp, this.vSide);
    if (speed > 1) {
      const drag = 0.5 * 1.225 * air * 0.35 * 3.5 * speed * speed / m;
      a -= drag * (this.vUp / speed);
      ax -= drag * (this.vSide / speed);
    }
    this.vUp += a * dt;
    this.vSide += ax * dt;
    this.alt = Math.max(0, this.alt + this.vUp * dt);
    if (this.alt <= 0 && this.vUp < 0) this.vUp = 0;

    for (const d of this.debris) { d.age += dt; d.vy -= 9 * dt; d.y += d.vy * dt; d.a += d.spin * dt; }
    this.debris = this.debris.filter(d => d.age < 6);

    engineSound.set(s && this.fuel > 0 ? 1 : 0, 1 - airAt(this.alt));
    if (s && this.fuel <= 0) this.drop();
    if (!this.stageNow()) {
      // out of fuel: work out where that speed carries the rocket and let the number climb
      this.burnout = this.vUp;
      const up = Math.max(0, this.vUp);
      this.topKm = coastHeight(up, this.alt / 1000);
      const r = rungFor(up);
      this.result = up;
      this.earnedRung = r.index;
      if (!isFinite(this.topKm)) this.topKm = r.rung.km;
      engineSound.stop();
      this.phase = 'coast'; this.phaseT = 0;
      this.shownKm = this.alt / 1000;
    }
  }

  private liveMass(): number {
    let m = partById('capsule').dry;
    this.stack.forEach((id, i) => { if (!this.dropped.has(i)) m += partById(id).dry; });
    return m + this.fuel + this.stages.slice(this.stageIndex + 1).reduce((a, s) => a + s.fuel, 0);
  }

  private finish(): void {
    const r = rungFor(this.result);
    this.earnedRung = r.index;
    const was = this.best();
    if (r.index > was) {
      save.moon = { best: r.index, stack: [...this.stack] };
      persist();
      const got = PARTS.find(p => p.unlockAt > was && p.unlockAt <= r.index);
      this.freshUnlock = got ? got.id : null;
      rocket.record();
    } else {
      rocket.land();
    }
    this.phase = 'done'; this.phaseT = 0;
  }

  // ---------- input ----------

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    // draw() shifts everything down past the notch, so a tap comes back up by the same amount
    return { x: e.clientX - r.left, y: e.clientY - r.top - this.st };
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
    this.idle = 0;
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (!hit) { this.picked = -1; return; }
    this.held = hit;
    if (hit.startsWith('tray:')) { this.add(hit.slice(5)); return; }
    if (hit.startsWith('part:')) {
      const i = Number(hit.slice(5));
      if (this.picked === i) this.removeAt(i); else { this.picked = i; rocket.tap(); }
      return;
    }
    if (hit === 'launch') { this.launch(); return; }
    if (hit === 'clear') { this.stack = []; this.picked = -1; this.remember(); rocket.clunk(); return; }
    if (hit === 'left') { this.steer = -1; return; }
    if (hit === 'right') { this.steer = 1; return; }
    if (hit === 'warp') {
      // the burn is the part you steer, so it speeds up only as far as 2x; the coast, where there
      // is nothing left to do but watch the number climb, goes to 4x
      const cap = this.phase === 'fly' ? 2 : 4;
      this.warp = this.warp >= cap ? 1 : this.warp * 2;
      rocket.tap();
      return;
    }
    if (hit === 'again') { engineSound.stop(); this.phase = 'build'; this.phaseT = 0; rocket.tap(); return; }
  }

  private onUp(): void {
    this.held = null;
    this.steer = 0;
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    const k = e.key;
    if (['ArrowLeft', 'ArrowRight', ' '].includes(k)) e.preventDefault();
    if (!down) { if (k === 'ArrowLeft' || k === 'ArrowRight') this.steer = 0; return; }
    unlockAudio();
    this.idle = 0;
    if (k === 'ArrowLeft') this.steer = -1;
    else if (k === 'ArrowRight') this.steer = 1;
    else if (k === ' ') { if (this.phase === 'build') this.launch(); else if (this.phase === 'done') this.phase = 'build'; }
  }

  // ---------- drawing ----------

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(0, this.st);
    this.hits = [];
    if (this.phase === 'build') { this.drawBuild(); return; }
    this.drawFlight();
  }

  // ---------- the workshop ----------

  private drawBuild(): void {
    const ctx = this.ctx, u = this.u();
    const b = this.bands();
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, '#16223a');
    sky.addColorStop(0.55, '#26385480'.slice(0, 7));
    sky.addColorStop(1, '#3d5170');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.w, this.h);

    // the hangar: girders behind, a floor the rocket stands on
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.w; x += 36 * u) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, b.rocketBase); ctx.stroke(); }
    for (let y = 40 * u; y < b.rocketBase; y += 36 * u) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(10, 16, 28, 0.5)';
    ctx.fillRect(0, b.rocketBase, this.w, this.h - b.rocketBase);
    ctx.fillStyle = 'rgba(180, 210, 255, 0.16)';
    ctx.fillRect(0, b.rocketBase, this.w, 2 * u);

    // the rocket on its stand, sitting on the floor
    const unit = this.buildUnit();
    const cx = this.w * 0.5;
    const boxes = paintRocket(ctx, this.stack, cx, b.rocketBase, unit, this.t);
    for (const box of boxes) {
      if (box.i < 0) continue;
      this.hits.push({ id: `part:${box.i}`, x: box.x, y: box.y, w: box.w, h: box.h });
      if (this.picked === box.i) {
        ctx.strokeStyle = '#ffd86b';
        ctx.lineWidth = 2.4 * u;
        ctx.strokeRect(box.x - 2 * u, box.y - 2 * u, box.w + 4 * u, box.h + 4 * u);
        ctx.fillStyle = 'rgba(255, 216, 107, 0.92)';
        ctx.font = this.font('900', 10.5);
        ctx.textAlign = 'center';
        ctx.fillText(T('tap again to take it off', 'tik nog eens om hem eraf te halen'),
          cx, Math.max(b.rocketTop - 4 * u, box.y - 8 * u), this.w - 24 * u);
      }
    }
    if (!this.stack.length) {
      ctx.fillStyle = 'rgba(226, 238, 252, 0.62)';
      ctx.font = this.font('800', 13);
      ctx.textAlign = 'center';
      ctx.fillText(T('Pick a part below to start.', 'Kies hieronder een onderdeel om te beginnen.'),
        cx, b.rocketBase - 40 * u, this.w - 40 * u);
    }

    this.drawScales(b.scaleX, b.scaleY);
    this.drawTray(b);

    if (this.noteT > 0) {
      ctx.save();
      ctx.globalAlpha = clamp(this.noteT, 0, 1);
      ctx.font = this.font('800', 12);
      const lines = wrap(ctx, this.note, this.w - 76 * u);
      const bh = lines.length * 17 * u + 15 * u;
      const ny = b.trayY - bh - 10 * u;
      glassPanel(ctx, 24 * u, ny, this.w - 48 * u, bh, 14 * u, 0.95);
      ctx.fillStyle = '#12233b';
      ctx.textAlign = 'center';
      lines.forEach((ln, i) => ctx.fillText(ln, this.w / 2, ny + 21 * u + i * 17 * u, this.w - 76 * u));
      ctx.restore();
    }
    ctx.textAlign = 'left';
  }

  /**
   * The balance. Push on one side, weight on the other, and a beam that tips the way the sum
   * comes out. It is the only thing on the screen that decides whether the button is green.
   */
  private drawScales(cx: number, y: number): void {
    const ctx = this.ctx, u = this.u();
    const push = liftThrust(this.stack), weight = padWeight(this.stack);
    const ok = canLift(this.stack);
    const arm = Math.min(78 * u, this.w * 0.24);
    const lean = clamp((push - weight) / Math.max(1, Math.max(push, weight)) * 0.4, -0.3, 0.3);

    ctx.save();
    ctx.translate(cx, y);
    ctx.strokeStyle = 'rgba(226,238,252,0.3)';
    ctx.lineWidth = 2 * u;
    ctx.beginPath(); ctx.moveTo(0, 2 * u); ctx.lineTo(0, 22 * u); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-9 * u, 22 * u); ctx.lineTo(9 * u, 22 * u); ctx.stroke();
    ctx.save();
    ctx.rotate(-lean);
    ctx.strokeStyle = ok ? '#8ee8ad' : '#f0b27a';
    ctx.lineWidth = 3.2 * u;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-arm, 0); ctx.lineTo(arm, 0); ctx.stroke();
    for (const [sx, label, val, tone] of [
      [-1, T('PUSH', 'DUW'), push, ok ? '#8ee8ad' : '#e2ecf8'],
      [1, T('WEIGHT', 'GEWICHT'), weight, ok ? '#e2ecf8' : '#f0b27a'],
    ] as const) {
      ctx.save();
      ctx.translate(sx * arm, 0);
      ctx.rotate(lean);
      ctx.fillStyle = 'rgba(10, 18, 34, 0.78)';
      ctx.beginPath(); ctx.roundRect(-34 * u, 3 * u, 68 * u, 34 * u, 10 * u); ctx.fill();
      ctx.fillStyle = 'rgba(226,238,252,0.6)';
      ctx.font = this.font('900', 8.5);
      ctx.textAlign = 'center';
      ctx.fillText(label, 0, 14 * u);
      ctx.fillStyle = tone;
      ctx.font = this.font('900', 15);
      ctx.fillText(String(Math.round(val)), 0, 31 * u);
      ctx.restore();
    }
    ctx.restore();
    ctx.restore();
    // and in words, for the one thing the balance is there to say
    ctx.textAlign = 'center';
    ctx.fillStyle = ok ? 'rgba(142, 232, 173, 0.95)' : 'rgba(240, 178, 122, 0.95)';
    ctx.font = this.font('900', 11.5);
    ctx.fillText(ok
      ? T('The push wins. It will fly.', 'De duw wint. Hij gaat vliegen.')
      : T('Too heavy to lift.', 'Te zwaar om op te tillen.'), cx, y + 76 * u, arm * 2 + 60 * u);
    ctx.textAlign = 'left';
  }

  /** The parts you may use, along the bottom, with the locked ones still visible but shut. */
  private drawTray(b: { trayY: number; trayH: number; launchY: number }): void {
    const ctx = this.ctx, u = this.u();
    const trayH = b.trayH, y0 = b.trayY;
    ctx.fillStyle = 'rgba(8, 14, 26, 0.78)';
    ctx.fillRect(0, y0, this.w, trayH);
    ctx.fillStyle = 'rgba(180, 210, 255, 0.12)';
    ctx.fillRect(0, y0, this.w, 1.5 * u);

    const list = this.trayList();
    const { cols, rows } = this.trayGrid();
    const rowH = trayH / rows;
    const cell = clamp((this.w - 12 * u) / cols, 56, 92 * u);
    list.forEach((p, k) => {
      const row = Math.floor(k / cols), col = k % cols;
      const inRow = Math.min(cols, list.length - row * cols);
      const x = Math.max(6 * u, (this.w - inRow * cell) / 2) + col * cell;
      const ry = y0 + row * rowH;
      const open = this.unlocked(p);
      const cy = ry + rowH * 0.42;
      ctx.save();
      ctx.globalAlpha = open ? 1 : 0.4;
      const pu = Math.min((cell - 14 * u) / Math.max(1, p.w), (rowH * 0.46) / Math.max(1, p.h));
      paintPart(ctx, p, x + cell / 2, cy + (p.h * pu) / 2, pu, this.t);
      ctx.restore();
      ctx.fillStyle = open ? 'rgba(226,238,252,0.92)' : 'rgba(226,238,252,0.55)';
      ctx.font = this.font('800', 9);
      ctx.textAlign = 'center';
      ctx.fillText(nameOf(p), x + cell / 2, ry + rowH - 20 * u, cell - 4 * u);
      ctx.fillStyle = open ? '#ffd86b' : 'rgba(255,216,107,0.4)';
      ctx.font = this.font('900', 10);
      const tag = p.kind === 'tank' ? `${p.fuel} t`
        : p.kind === 'engine' || p.kind === 'booster' ? `${Math.round(p.burn * p.exhaust)}`
          : `${p.dry} t`;
      ctx.fillText(tag, x + cell / 2, ry + rowH - 7 * u, cell - 4 * u);
      if (!open) padlock(ctx, x + cell / 2, cy, 9 * u);
      this.hits.push({ id: `tray:${p.id}`, x, y: ry, w: cell, h: rowH });
    });

    const bh = 50 * u, by = b.launchY;
    const cw = 54 * u;
    const bw = Math.min(210 * u, this.w - cw - 30 * u);
    const bx = (this.w - cw - 10 * u) / 2 - bw / 2 + 4 * u;
    const ready = isFlyable(this.stack);
    const face = chunkyButton(ctx, bx, by, bw, bh, { tone: ready ? '#65d48c' : '#6d7787', pressed: this.held === 'launch' });
    ctx.fillStyle = ready ? '#0b2a1c' : 'rgba(255,255,255,0.7)';
    ctx.font = this.font('900', 17);
    ctx.textAlign = 'center';
    ctx.fillText(T('Launch', 'Lanceren'), bx + bw / 2, face.y + bh * 0.64, bw - 18 * u);
    this.hits.push({ id: 'launch', x: bx, y: by, w: bw, h: bh });

    const cface = chunkyButton(ctx, this.w - cw - 8 * u, by, cw, bh, { tone: '#46516a', pressed: this.held === 'clear' });
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = this.font('900', 11);
    ctx.fillText(T('Empty', 'Leeg'), this.w - cw / 2 - 8 * u, cface.y + bh * 0.62, cw - 8 * u);
    this.hits.push({ id: 'clear', x: this.w - cw - 8 * u, y: by, w: cw, h: bh });

    // what to aim at next, tucked above the tray
    const nxt = nextRung(this.best());
    if (nxt && this.noteT <= 0) {
      ctx.fillStyle = 'rgba(226,238,252,0.55)';
      ctx.font = this.font('700', 11);
      ctx.fillText(T(`Next up: ${nxt.name}`, `Hierna: ${nxt.nameNl}`), this.w / 2, y0 - 10 * u, this.w - 30 * u);
    }
    ctx.textAlign = 'left';
  }

  // ---------- the flight ----------

  private drawFlight(): void {
    const ctx = this.ctx, u = this.u();
    const tone = skyTone(this.alt);
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, tone.top);
    g.addColorStop(1, tone.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    paintStars(ctx, this.w, this.h, tone.stars, this.alt * 0.02);
    paintEarthBelow(ctx, this.w, this.h, this.alt, u);

    ctx.save();
    this.shake.apply(ctx, 7 * u);

    // The rocket keeps its place on the screen and the ground falls away under it, which is what
    // climbing looks like from a camera that is following you.
    const unit = clamp(this.h / 26, 7, 30 * u);
    const cx = this.w * 0.5 - this.vSide * 0.0004 * this.w;
    const ry = this.h * 0.6;
    const gy = ry + unit * 0.2 + this.alt * (this.h / 2200);
    if (gy < this.h + 60 * u) {
      paintPad(ctx, this.w, gy, unit);
      paintTower(ctx, this.w * 0.5 - unit * 4.4, gy, unit, unit * 12);
    }

    // clouds going past: a handful of layers at real heights, gone by ten kilometres
    for (let k = 0; k < 5; k++) {
      const band = 900 + k * 1600;
      const d = this.alt - band;
      const yy = this.h * 0.5 + d * 0.1;
      if (yy > -150 && yy < this.h + 150) {
        const fade = clamp(1 - Math.abs(d) / 2600, 0, 1);
        paintCloud(ctx, ((k * 173) % 100) / 100 * this.w, yy, this.w * (0.12 + (k % 3) * 0.035), fade * 0.8, k * 7);
      }
    }

    // the rocket, leaning the way it is steered
    ctx.save();
    ctx.translate(cx, ry);
    ctx.rotate(this.tilt);
    const s = this.stageNow();
    const burning = !!s && this.fuel > 0 && this.phase === 'fly';
    if (burning) {
      const spread = 1 - airAt(this.alt);
      const bodyW = partById(this.stack[s.parts[0]] ?? 'tank-s').w * unit;
      paintFlame(ctx, 0, 0, bodyW * 0.5, 1, spread, this.t);
      // boosters throw their own flames
      this.stack.forEach((id, i) => {
        const p = partById(id);
        if (p.kind !== 'booster' || this.dropped.has(i)) return;
        const n = this.stack.filter((q, k2) => partById(q).kind === 'booster' && !this.dropped.has(k2)).length;
        const mine = this.stack.slice(0, i).filter(q => partById(q).kind === 'booster').length;
        const side = n > 1 ? (mine % 2 === 0 ? -1 : 1) : -1;
        const off = (1 / 2 + p.w / 2) * unit * 0.92;
        paintFlame(ctx, side * off, -unit * 0.1, p.w * unit * 0.5, 0.9, spread, this.t + 0.4);
      });
    }
    paintRocket(ctx, this.stack, 0, 0, unit, this.t, { dropped: this.dropped });
    ctx.restore();

    // spent stages tumbling away
    for (const d of this.debris) {
      ctx.save();
      ctx.globalAlpha = clamp(1 - d.age / 6, 0, 1) * 0.9;
      ctx.translate(cx + Math.sin(d.a) * 20 * u, ry - d.y * 0.6);
      ctx.rotate(d.a);
      for (const i of d.parts) paintPart(ctx, partById(this.stack[i]), 0, 0, unit * 0.9, this.t);
      ctx.restore();
    }
    ctx.restore();

    this.ps.draw(ctx);
    vignette(ctx, this.w, this.h, 0.22);
    paintGrain(ctx, this.w, this.h);
    this.drawFlightChrome();
  }

  private drawFlightChrome(): void {
    const ctx = this.ctx, u = this.u();

    // Height and speed on the left: the way back to Bramblewood owns the top right corner, and a
    // number hiding behind it is a number nobody can read.
    ctx.textAlign = 'left';
    const shown = this.phase === 'coast' || this.phase === 'done' ? this.shownKm : this.alt / 1000;
    outlinedText(ctx, kmLabel(shown, NL()), 14 * u, 36 * u, this.font('900', 20), '#ffffff', 'rgba(8,16,30,0.6)', 4);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = this.font('800', 10);
    ctx.fillText(T('height', 'hoogte'), 14 * u, 50 * u);
    outlinedText(ctx, `${Math.round(Math.hypot(this.vUp, this.vSide))} m/s`, 14 * u, 76 * u, this.font('900', 15), '#ffffff', 'rgba(8,16,30,0.6)', 4);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(T('speed', 'snelheid'), 14 * u, 90 * u);

    // the fuel that is left in the stage that is burning
    const s = this.stageNow();
    const bw = 12 * u, bh = Math.min(180 * u, this.h * 0.26);
    const bx = 16 * u, by = 112 * u;
    ctx.fillStyle = 'rgba(8, 16, 30, 0.45)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bw / 2); ctx.fill();
    if (s) {
      const k = clamp(this.fuel / Math.max(0.001, s.fuel), 0, 1);
      ctx.fillStyle = k > 0.25 ? '#ffd86b' : '#f2884f';
      ctx.beginPath(); ctx.roundRect(bx, by + bh * (1 - k), bw, bh * k, bw / 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = this.font('800', 9.5);
    ctx.fillText(T('fuel', 'brandstof'), bx, by - 6 * u);
    // which stage is alight
    for (let i = 0; i < this.stages.length; i++) {
      ctx.fillStyle = i < this.stageIndex ? 'rgba(255,255,255,0.25)' : i === this.stageIndex ? '#8ee8ad' : 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(bx + bw / 2, by + bh + 16 * u + i * 13 * u, 4.2 * u, 0, TAU); ctx.fill();
    }

    if (this.phase === 'count') {
      const c = Math.ceil(this.countdown);
      ctx.textAlign = 'center';
      const pop = 1 - (this.countdown - Math.floor(this.countdown));
      ctx.save();
      ctx.globalAlpha = clamp(1.4 - pop, 0, 1);
      outlinedText(ctx, String(Math.max(1, c)), this.w / 2, this.h * 0.32, this.font('900', 64), '#ffffff', 'rgba(8,16,30,0.5)', 6);
      ctx.restore();
    }

    if (this.phase === 'fly') this.drawSteering();
    if (this.phase === 'coast') {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = this.font('900', 14);
      ctx.fillText(T('Coasting…', 'Uitzweven…'), this.w / 2, this.h - 34 * u, this.w - 40 * u);
      this.warpButton();
    }
    if (this.phase === 'done') this.drawResult();
    ctx.textAlign = 'left';
  }

  /** Two thumbs and a bubble level, which is all the steering a rocket needs. */
  private drawSteering(): void {
    const ctx = this.ctx, u = this.u();
    const size = Math.min(76 * u, this.w * 0.2);
    const y = this.h - size - 20 * u;
    for (const [id, x, rot] of [['left', 16 * u, Math.PI], ['right', this.w - size - 16 * u, 0]] as const) {
      const on = this.held === id || (id === 'left' ? this.steer < 0 : this.steer > 0);
      const face = chunkyButton(ctx, x, y, size, size, { tone: on ? '#8ee8ad' : '#e9eef6', radius: size * 0.32, pressed: on });
      ctx.save();
      ctx.translate(x + size / 2, face.y + size / 2);
      ctx.rotate(rot);
      ctx.fillStyle = on ? '#0b2a1c' : '#25405e';
      ctx.beginPath();
      ctx.moveTo(size * 0.16, 0);
      ctx.lineTo(-size * 0.1, -size * 0.17);
      ctx.lineTo(-size * 0.1, size * 0.17);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      this.hits.push({ id, x, y, w: size, h: size });
    }
    // how far off straight up the rocket is leaning
    const lx = this.w / 2, ly = this.h - 42 * u, lw = Math.min(150 * u, this.w * 0.4);
    ctx.fillStyle = 'rgba(8, 16, 30, 0.42)';
    ctx.beginPath(); ctx.roundRect(lx - lw / 2, ly - 7 * u, lw, 14 * u, 7 * u); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(lx - 1 * u, ly - 10 * u, 2 * u, 20 * u);
    const k = clamp(this.tilt / 1.2, -1, 1);
    ctx.fillStyle = Math.abs(k) < 0.25 ? '#8ee8ad' : '#ffd86b';
    ctx.beginPath(); ctx.arc(lx + k * (lw / 2 - 8 * u), ly, 6 * u, 0, TAU); ctx.fill();
    this.warpButton();

    // the hand, if nothing has been touched and the rocket is drifting
    if (this.idle > 2 && Math.abs(this.tilt) > 0.22) {
      const want = this.tilt > 0 ? 'left' : 'right';
      const b = this.hits.find(h => h.id === want);
      if (b) {
        const press = clamp(Math.sin((this.t % 1.4) / 1.4 * Math.PI) * 1.8, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.5 + 0.4 * press;
        handCursor(ctx, b.x + b.w * 0.62, b.y + b.h * 0.5, 15 * u, press);
        ctx.restore();
      }
    }
  }

  private warpButton(): void {
    const ctx = this.ctx, u = this.u();
    const w = 52 * u, h = 34 * u, x = this.w - w - 14 * u, y = 62 * u;
    const face = chunkyButton(ctx, x, y, w, h, { tone: this.warp > 1 ? '#8ee8ad' : '#e9eef6', pressed: this.held === 'warp' });
    ctx.fillStyle = this.warp > 1 ? '#0b2a1c' : '#25405e';
    ctx.font = this.font('900', 13);
    ctx.textAlign = 'center';
    ctx.fillText(`${this.warp}×`, x + w / 2, face.y + h * 0.66, w - 8 * u);
    this.hits.push({ id: 'warp', x, y, w, h });
  }

  /** The card at the end: how far, what it is called, and what it opened up. */
  private drawResult(): void {
    const ctx = this.ctx, u = this.u();
    const r = LADDER[this.earnedRung];
    ctx.fillStyle = 'rgba(6, 12, 24, 0.55)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.phaseT * 2.2, 0, 1));
    const cw = Math.min(340 * u, this.w - 32 * u);
    const ch = (this.freshUnlock ? 320 : 250) * u;
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 26 * u, 0.97);
    ctx.textAlign = 'center';
    heading(ctx, NL() ? r.nameNl : r.name, this.w / 2, y + 48 * u, this.font('900', 20), '#12233b');
    ctx.fillStyle = 'rgba(18,35,59,0.72)';
    ctx.font = this.font('800', 13);
    ctx.fillText(kmLabel(this.topKm, NL()), this.w / 2, y + 74 * u, cw - 40 * u);
    ctx.fillStyle = 'rgba(18,35,59,0.55)';
    ctx.font = this.font('700', 11.5);
    ctx.fillText(T(`${Math.round(this.result)} m/s when the fuel ran out`, `${Math.round(this.result)} m/s toen de brandstof op was`),
      this.w / 2, y + 94 * u, cw - 40 * u);
    for (let i = 0; i < 5; i++) {
      const shown = clamp(this.phaseT * 2.4 - i * 0.2, 0, 1);
      drawStar(ctx, this.w / 2 + (i - 2) * 30 * u, y + 128 * u, 13 * u, i < r.stars, i < r.stars ? easeOutBack(shown) : 1);
    }
    if (this.freshUnlock) {
      const p = partById(this.freshUnlock);
      ctx.fillStyle = '#2f6d46';
      ctx.font = this.font('900', 12.5);
      ctx.fillText(T('New part unlocked', 'Nieuw onderdeel vrijgespeeld'), this.w / 2, y + 166 * u, cw - 40 * u);
      const pu = Math.min(46 * u / Math.max(1, p.w), 54 * u / Math.max(1, p.h));
      paintPart(ctx, p, this.w / 2, y + 226 * u, pu, this.t);
      ctx.fillStyle = '#12233b';
      ctx.font = this.font('800', 12);
      ctx.fillText(nameOf(p), this.w / 2, y + 246 * u, cw - 40 * u);
    }
    // the button grows with the card, so it is drawn inside the same transform
    const bw = Math.min(240 * u, cw - 28 * u), bh = 48 * u;
    const by = y + ch - 62 * u;
    const face = chunkyButton(ctx, this.w / 2 - bw / 2, by, bw, bh, { tone: '#65d48c', pressed: this.held === 'again' });
    ctx.fillStyle = '#0b2a1c';
    ctx.font = this.font('900', 15);
    ctx.textAlign = 'center';
    ctx.fillText(T('To the workshop', 'Naar de werkplaats'), this.w / 2, face.y + bh * 0.63, bw - 20 * u);
    ctx.restore();
    this.hits.push({ id: 'again', x: this.w / 2 - bw / 2, y: by, w: bw, h: bh });
  }
}

/** A drawn padlock, rather than an emoji that every phone renders differently. */
function padlock(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(232, 240, 252, 0.9)';
  ctx.lineWidth = Math.max(1.4, r * 0.24);
  ctx.beginPath();
  ctx.arc(x, y - r * 0.35, r * 0.5, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = 'rgba(232, 240, 252, 0.92)';
  ctx.beginPath();
  ctx.roundRect(x - r * 0.72, y - r * 0.32, r * 1.44, r * 1.15, r * 0.22);
  ctx.fill();
  ctx.fillStyle = 'rgba(20, 32, 52, 0.8)';
  ctx.beginPath(); ctx.arc(x, y + r * 0.24, r * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Break a line to fit a width, so a part's trade never runs off its card. */
function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) { lines.push(line); line = w; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
