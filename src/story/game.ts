/**
 * Suri en de reuzentand - the story journey, on screen.
 *
 * The script is in `script.ts`; this file is the stage. It plays the script one step at a time,
 * builds the world each chapter happens in, turns the camera the way the child looks, and turns
 * what the child does with a finger into the flags the script waits for. It knows nothing about
 * the words: if a line changes, nothing here does.
 *
 * Four kinds of place: the garden with Grandpa's shed, the tunnel the time drill bores, and three
 * worlds from the past - the ice age, the chalk sea and the forest where the T. rex walks. Each of
 * those is a full circle round the camera, and the animal the story is about is somewhere in it,
 * often behind you, so finding it means turning round. That is the part a picture book cannot do.
 */

import { unlockAudio } from '../util/audio';
import { GUIDE_KEEP, safeArea, uiScale } from '../util/ui';
import { bleedEdges, chunkyButton, glassPanel, outlinedText, Particles, vignette } from '../render/look';
import { drawGuide } from '../platform/guide';
import { NL, T } from '../util/lang';
import { forgetLine, isSpeaking, sayRecorded, speakLine } from '../platform/voice';
import { save, persist } from '../util/storage';
import { ASIDES, CHAPTERS, nextPlace, readSeconds, type Chapter, type Place, type Step } from './script';
import { Look, TAU, wrapAngle } from './look';
import { drawBackdrop, drawProp, makeView, near, PALETTES, scatter, spot, type Palette, type Prop, type View } from './world';
import { drawMammoth, drawMosasaur, drawTRex, drawTriceratops, type BeastLook } from './beasts';
import { bed, storySfx, thud, type Bed } from './storysfx';

type Ctx = CanvasRenderingContext2D;
type World = 'garden' | 'tunnel' | 'ice' | 'sea' | 'forest';

interface Hit { id: string; x: number; y: number; w: number; h: number }

/** An animal somewhere in the circle round the camera. */
interface Beast {
  kind: 'mammoth' | 'mosasaur' | 'trike' | 'trex';
  x: number; z: number;
  /** metres per second, and which way (radians, world) */
  speed: number; heading: number;
  /** for animals that walk a circle round you, instead of a straight line */
  orbit?: { r: number; a: number; w: number };
  phase: number;
  /** metres of stride per full step cycle, so the feet stay put on the ground */
  stride: number;
  head: number; jaw: number;
  lift: number;
}

/** What the child is carrying across the screen: the tooth to compare, or a fern to feed. */
interface Carry { kind: 'tooth' | 'fern'; x: number; y: number }

/** The years on the gauge at each place the drill stops. */
const YEARS: Record<string, number> = { garden: 0, ice: 20000, sea: 68000000, forest: 68000000 };

export class Story {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private st = 0; private sb = 0; private sl = 0; private sr = 0;
  private fullW = 0; private fullH = 0;
  private t = 0;
  private raf = 0;
  private look: Look;

  private place: Place = { chapter: 0, step: 0 };
  private stepT = 0;
  private started = false;
  private finished = false;
  private flags = new Set<string>();
  private line = '';
  private lineMin = 0;

  private world: World = 'garden';
  private props: Prop[] = [];
  private beast: Beast | null = null;
  private ps = new Particles();

  // the garden: a grid over the tooth, and which cells the finger has brushed clean
  private sand: boolean[] = [];
  private brushing = false;
  private shineT = 0;

  // the tunnel: where the drill is between two years, and how fast it is going
  private lever = 0;
  private leverHeld = false;
  private tunnel: { t: number; dur: number; from: number; to: number; dir: 1 | -1 } | null = null;
  private years = 0;
  private boreT = 0;

  // finding, comparing, feeding
  private seenT = 0;
  private lostT = 0;
  private hinted = false;
  private carry: Carry | null = null;
  private verdict: { t: number; ok: boolean; x: number; y: number } | null = null;

  // the T. rex
  private sniffT = 0;
  private hushed = 0;
  private stepPhase = 0;
  private glint: { x: number; z: number } | null = null;
  private matchT = -1;
  private shake = 0;

  private hits: Hit[] = [];
  private held: string | null = null;
  private titleT = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.look = new Look(() => this.w, () => this.w / makeView(this.w, this.h, 0).f);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointermove', e => this.onMove(e));
    canvas.addEventListener('pointerup', e => this.onUp(e));
    canvas.addEventListener('pointercancel', e => this.onUp(e));
    (window as unknown as { __tand?: Story }).__tand = this;
    this.enterChapter(0);
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
  }

  destroy(): void { cancelAnimationFrame(this.raf); bed(null); }
  canBack(): boolean { return false; }
  back(): void { /* one story, no screens behind it */ }
  spoken(): string { return this.line || T('Tap to begin.', 'Tik om te beginnen.'); }

  debugState(): Record<string, unknown> {
    const c = CHAPTERS[this.place.chapter];
    const step = c.steps[this.place.step];
    return {
      chapter: c.id, step: this.place.step, started: this.started, finished: this.finished,
      waiting: step && 'wait' in step ? step.wait : null,
      flags: [...this.flags], world: this.world, yaw: Math.round(this.look.yaw * 100) / 100,
      line: this.line, years: Math.round(this.years),
      beast: this.beast ? { kind: this.beast.kind, x: Math.round(this.beast.x), z: Math.round(this.beast.z), ...this.beastScreen() } : null,
      buttons: this.hits.map(b => ({ id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2) })),
    };
  }

  /** For the tests and the audit: jump straight to a chapter. */
  jump(i: number): void { this.started = true; this.finished = false; this.enterChapter(i); }

  /** For the tests: set a flag the story is waiting for, as if the child had done it. */
  set(flag: string): void { this.flags.add(flag); }

  private beastScreen(): { sx: number; sy: number; on: boolean } {
    if (!this.beast) return { sx: 0, sy: 0, on: false };
    const v = this.view();
    const p = spot(v, this.beast.x, this.beast.z, this.beast.lift);
    return { sx: Math.round(p.x), sy: Math.round(p.y), on: Math.abs(p.off) < (v.w / v.f) / 2 };
  }

  // ---------------------------------------------------------------- layout

  private u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
    const safe = safeArea();
    this.st = safe.top; this.sb = safe.bottom; this.sl = safe.left; this.sr = safe.right;
    this.fullW = Math.max(1, window.innerWidth);
    this.fullH = Math.max(1, window.innerHeight);
    this.w = Math.max(1, this.fullW - this.sl - this.sr);
    this.h = Math.max(1, this.fullH - this.st - this.sb);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.fullW * this.dpr);
    this.canvas.height = Math.round(this.fullH * this.dpr);
  }

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  private view(): View {
    const v = makeView(this.w, this.h, this.look.yaw);
    if (this.world === 'garden') v.horizon = this.h * 0.42;
    return v;
  }

  /** The box of sand at the bottom of the garden scene: where the tooth is. */
  private boxRect(): { x: number; y: number; w: number; h: number } {
    const u = this.u();
    const wide = this.w > this.h;
    const bw = Math.min(this.w - 40 * u, wide ? 300 * u : 340 * u), bh = Math.min(bw * 0.5, this.h * (wide ? 0.3 : 0.24));
    // above the line of words at the bottom, and in front of Suri rather than over the shed
    return { x: wide ? this.w * 0.58 - bw / 2 : (this.w - bw) / 2, y: this.h - bh - (wide ? 76 : 150) * u, w: bw, h: bh };
  }

  /** Where the carried thing waits, and goes back to, at the bottom of the screen. */
  private trayAt(): { x: number; y: number } {
    return { x: this.w - 70 * this.u(), y: this.h - 170 * this.u() };
  }

  // ---------------------------------------------------------------- the script

  private enterChapter(i: number): void {
    // a tunnel still running from before (a jump, a restart) must not finish into this chapter
    this.tunnel = null;
    this.onTunnelEnd = null;
    this.place = { chapter: i, step: 0 };
    this.stepT = 0;
    this.flags.clear();
    this.carry = null;
    this.verdict = null;
    this.glint = null;
    this.matchT = -1;
    this.seenT = 0; this.lostT = 0; this.hinted = false;
    this.titleT = 3;
    const c = CHAPTERS[i];
    this.look.reset();
    if (c.id === 'garden') this.buildGarden();
    else if (c.id === 'drill') { this.world = 'tunnel'; this.lever = 0; this.years = 0; this.tunnel = null; }
    else if (c.id === 'ice') this.buildIce();
    else if (c.id === 'sea') this.startTunnel(YEARS.ice, YEARS.sea, 1, 3.2, () => this.buildSea());
    else if (c.id === 'forest') this.startTunnel(YEARS.sea, YEARS.forest, 1, 2.6, () => this.buildForest());
    else if (c.id === 'trex') { if (this.world !== 'forest') this.buildForest(); /* otherwise the same forest, still there */ }
    else if (c.id === 'home') { this.world = 'tunnel'; this.tunnel = null; }
    this.bedFor();
    if (this.started) this.runStep();
  }

  private step(): Step | undefined {
    return CHAPTERS[this.place.chapter].steps[this.place.step];
  }

  /** Start whatever the current step asks for. */
  private runStep(): void {
    const s = this.step();
    this.stepT = 0;
    if (!s) return;
    if ('say' in s) this.say(NL() ? s.sayNl : s.say);
    else if ('cue' in s) { this.cue(s.cue); this.advance(); }
  }

  private advance(): void {
    const next = nextPlace(this.place);
    if (!next) { this.finished = true; return; }
    if (next.chapter !== this.place.chapter) { this.enterChapter(next.chapter); return; }
    this.place = next;
    this.runStep();
  }

  private say(text: string): void {
    this.line = text;
    this.lineMin = readSeconds(text) * 0.55;
    if (!sayRecorded([text])) { forgetLine(); speakLine(text); }
  }

  private aside(a: { say: string; sayNl: string }): void {
    const text = NL() ? a.sayNl : a.say;
    this.line = text;
    if (!sayRecorded([text])) { forgetLine(); speakLine(text); }
  }

  /** Has the current step finished? Lines when Ruth has stopped, waits when the child has done it. */
  private stepDone(): boolean {
    const s = this.step();
    if (!s) return false;
    if ('say' in s) return this.stepT > 0.7 && this.stepT >= this.lineMin && !isSpeaking();
    if ('wait' in s) return this.flags.has(s.wait);
    if ('pause' in s) return this.stepT >= s.pause;
    return true;
  }

  private cue(name: string): void {
    const u = this.u();
    if (name === 'shine') { this.shineT = 1.6; storySfx.shine(); this.ps.spawn('spark', this.w / 2, this.boxRect().y + this.boxRect().h / 2, 18, { colour: '#ffe79a', speed: 160, size: 7 * u, max: 1, spread: TAU }); }
    else if (name === 'descend') this.startTunnel(0, YEARS.ice, 1, 7.5, () => this.flags.add('arrived'));
    else if (name === 'ascend') this.startTunnel(YEARS.forest, 0, -1, 5.5, () => { this.buildGarden(); this.flags.add('arrived'); });
    else if (name === 'rumble') { this.shake = 0.6; thud(); setTimeout(() => thud(), 700); }
    else if (name === 'enter') this.trexEnters();
    else if (name === 'glint') { this.glint = { x: 0.8, z: 6 }; this.turnTo(Math.atan2(0.8, 6), 2.5); }
    else if (name === 'match') { this.matchT = 0; }
    else if (name === 'end') { storySfx.done(); this.finished = true; this.markSeen(); }
  }

  /** Turn the camera to something the story is about to talk about, and hand it back afterwards. */
  private turnTo(angle: number, secs: number): void {
    this.look.guide(angle);
    this.guideT = secs;
  }
  private guideT = 0;

  private markSeen(): void {
    const j = save.journeys as Record<string, string[]>;
    j.tand = CHAPTERS.map(c => c.id);
    persist();
  }

  // ---------------------------------------------------------------- the worlds

  private bedFor(): void {
    const m: Record<World, Bed | null> = { garden: 'garden', tunnel: 'drill', ice: 'wind', sea: 'sea', forest: 'forest' };
    if (this.started) bed(m[this.world]);
  }

  private buildGarden(): void {
    this.world = 'garden';
    this.beast = null;
    this.props = [
      { kind: 'shed', x: 1.5, z: 9, size: 1, seed: 1 },
      ...scatter(11, [['hedge', 14, 1], ['tree', 9, 1.1], ['flower', 30, 1], ['tuft', 40, 1]], 0.35, 7),
      ...near(12, [['tuft', 40, 0.9], ['flower', 20, 0.8]]),
    ];
    const cols = 12, rows = 6;
    this.sand = new Array(cols * rows).fill(false);
    this.years = 0;
  }

  private buildIce(): void {
    this.world = 'ice';
    this.props = [...scatter(21, [['drift', 40, 1.4], ['rock', 16, 1.2], ['conifer', 10, 1.4]], 0.4, 12), ...near(22, [['drift', 16, 0.6], ['rock', 8, 0.35]])];
    // the mammoth walks a slow circle round you, starting behind you, so you have to turn to find him
    this.beast = { kind: 'mammoth', x: 0, z: 0, speed: 0.9, heading: 0, orbit: { r: 14, a: Math.PI * 0.9, w: 0.9 / 14 }, phase: 0, stride: 2.2, head: 0, jaw: 0, lift: 0 };
    this.years = YEARS.ice;
  }

  private buildSea(): void {
    this.world = 'sea';
    this.props = [...scatter(31, [['weed', 40, 1.5], ['rock', 18, 1.3], ['shell', 30, 1]], 0.3, 8), ...near(32, [['weed', 18, 0.7], ['shell', 24, 0.6], ['rock', 6, 0.4]])];
    this.beast = { kind: 'mosasaur', x: 0, z: 0, speed: 2.2, heading: 0, orbit: { r: 22, a: -Math.PI * 0.75, w: -2.2 / 22 }, phase: 0, stride: 3, head: 0, jaw: 0, lift: 3.2 };
    this.years = YEARS.sea;
  }

  private buildForest(): void {
    this.world = 'forest';
    this.props = [...scatter(41, [['fern', 60, 1.2], ['cycad', 18, 1.4], ['palm', 12, 1.3], ['conifer', 8, 1.8], ['rock', 8, 1]], 0.45, 14), ...near(42, [['fern', 26, 0.8], ['tuft', 30, 0.8]])];
    // the Triceratops is grazing behind you and to your left, head down, until you find him
    this.beast = { kind: 'trike', x: Math.sin(-2.3) * 14, z: Math.cos(-2.3) * 14, speed: 0, heading: 0, phase: 0, stride: 1.6, head: -0.8, jaw: 0, lift: 0 };
    this.years = YEARS.forest;
  }

  private trexEnters(): void {
    // from far off on the left, walking across in front of you and away to the right
    this.beast = { kind: 'trex', x: -40, z: 11, speed: 3, heading: Math.PI / 2, phase: 0, stride: 3.2, head: 0, jaw: 0, lift: 0 };
    this.hushed = 0;
    this.sniffT = 0;
    storySfx.roar();
    this.shake = 0.8;
  }

  private startTunnel(from: number, to: number, dir: 1 | -1, dur: number, then: () => void): void {
    this.world = 'tunnel';
    this.beast = null;
    this.tunnel = { t: 0, dur, from, to, dir };
    this.years = from;
    this.onTunnelEnd = then;
    this.bedFor();
  }
  private onTunnelEnd: (() => void) | null = null;

  // ---------------------------------------------------------------- update

  private update(dt: number): void {
    this.look.update(dt);
    this.ps.update(dt);
    this.shineT = Math.max(0, this.shineT - dt);
    this.titleT = Math.max(0, this.titleT - dt);
    if (this.guideT > 0) { this.guideT -= dt; if (this.guideT <= 0) this.look.guide(null); }
    this.shake = Math.max(0, this.shake - dt);
    if (this.verdict) { this.verdict.t += dt; if (this.verdict.t > 1.6) this.verdict = null; }
    if (this.matchT >= 0) this.matchT += dt;
    if (!this.started) return;

    this.stepT += dt;
    if (this.tunnel) this.updateTunnel(dt);
    if (this.beast) this.updateBeast(dt);
    this.updateFinding(dt);
    if (this.world === 'ice' && Math.random() < dt * 30) {
      this.ps.spawn('dust', Math.random() * this.w, -10, 1, { colour: '#ffffff', speed: 30, spread: 0.5, max: 4, grav: 25, size: (2 + Math.random() * 3) * this.u() });
    }
    if (this.world === 'sea' && Math.random() < dt * 6) {
      this.ps.spawn('dust', Math.random() * this.w, this.h + 10, 1, { colour: 'rgba(220,245,255,0.8)', speed: 40, spread: 0.3, max: 5, grav: -30, size: (2 + Math.random() * 4) * this.u() });
    }
    if (this.stepDone() && !this.finished) this.advance();
  }

  private updateTunnel(dt: number): void {
    const tn = this.tunnel!;
    if (CHAPTERS[this.place.chapter].id === 'drill' && !this.flags.has('lever')) return;
    tn.t += dt;
    const k = Math.min(1, tn.t / tn.dur);
    // the years count slowly at first and then rush, because each layer down is older than the
    // last by more: the gauge is logarithmic, the only way twenty thousand and sixty-eight million
    // can both be seen going by
    const lf = Math.log10(tn.from + 1), lt = Math.log10(tn.to + 1);
    const ease = k * k * (3 - 2 * k);
    this.years = Math.pow(10, lf + (lt - lf) * ease) - 1;
    this.boreT += dt * (0.6 + Math.sin(k * Math.PI) * 2.4);
    if (k >= 1) {
      this.tunnel = null;
      storySfx.arrive();
      const then = this.onTunnelEnd;
      this.onTunnelEnd = null;
      then?.();
      this.look.reset();
      this.bedFor();
    }
  }

  private updateBeast(dt: number): void {
    const b = this.beast!;
    if (b.kind === 'trex') {
      // stopping to sniff when a finger touches the screen, and walking on afterwards
      if (this.sniffT > 0) {
        this.sniffT -= dt;
        b.head += (-0.9 - b.head) * Math.min(1, dt * 3);
        if (Math.random() < dt * 1.5) storySfx.sniff();
      } else {
        b.head += (0.1 - b.head) * Math.min(1, dt * 2);
        const was = b.phase;
        b.x += Math.sin(b.heading) * b.speed * dt;
        b.z += Math.cos(b.heading) * b.speed * dt;
        b.phase += (b.speed * dt) / b.stride;
        // one thud per footfall, felt as well as heard, loudest when he is close
        if (Math.floor(was * 2) !== Math.floor(b.phase * 2) && Math.hypot(b.x, b.z) < 30) { thud(); this.shake = Math.max(this.shake, 0.25); }
      }
      // keep the camera on him while he passes, gently, unless the child is turning it themselves
      this.look.guide(this.look.dragging ? null : Math.atan2(b.x, b.z));
      if (b.x > 32 && !this.flags.has('passed')) { this.flags.add('passed'); this.look.guide(null); this.beast = null; this.buildForestKeepTrike(); }
      return;
    }
    if (b.orbit) {
      b.orbit.a += b.orbit.w * dt;
      b.x = Math.sin(b.orbit.a) * b.orbit.r;
      b.z = Math.cos(b.orbit.a) * b.orbit.r;
      b.phase += (b.speed * dt) / b.stride;
    }
    if (b.kind === 'trike') {
      // grazing: head down and a slow chew, head up once the child has found him
      const target = this.flags.has('found') && !this.flags.has('fed') ? 0.1 : -0.8;
      b.head += (target - b.head) * Math.min(1, dt * 2);
    }
  }

  /** After the T. rex, the forest goes back to the Triceratops, grazing where he was. */
  private buildForestKeepTrike(): void {
    this.beast = { kind: 'trike', x: Math.sin(-2.3) * 14, z: Math.cos(-2.3) * 14, speed: 0, heading: 0, phase: 0, stride: 1.6, head: -0.8, jaw: 0, lift: 0 };
  }

  /** The "look around and find him" beat: found once he has been in the middle of the view a moment. */
  private updateFinding(dt: number): void {
    const s = this.step();
    if (!s || !('wait' in s) || s.wait !== 'found' || !this.beast) return;
    const bs = this.beastScreen();
    const central = bs.on && Math.abs(bs.sx - this.w / 2) < this.w * 0.3;
    if (central) { this.seenT += dt; this.lostT = 0; } else { this.seenT = 0; this.lostT += dt; }
    if (this.seenT > 0.6) {
      this.flags.add('found');
      if (this.beast.kind === 'mammoth') storySfx.trumpet();
      else if (this.beast.kind === 'mosasaur') storySfx.splash();
    }
    if (this.lostT > 7 && !this.hinted) { this.hinted = true; this.aside(ASIDES.lookAround); }
  }

  // ---------------------------------------------------------------- input

  private at(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: { x: number; y: number }): string | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    }
    return null;
  }

  private waiting(): string | null {
    const s = this.step();
    return s && 'wait' in s ? s.wait : null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    this.look.askForTilt();
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (hit) { this.held = hit; this.press(hit); return; }
    if (!this.started) { this.begin(); return; }
    const w = this.waiting();
    const u = this.u();
    // the T. rex notices a touch: he stops and sniffs, and then walks on anyway
    if (this.beast?.kind === 'trex' && !this.flags.has('passed')) {
      if (this.sniffT <= 0) { this.sniffT = 2.2; this.hushed++; if (this.hushed <= 2) this.aside(ASIDES.hush); }
      this.look.down(p.x);
      return;
    }
    if (w === 'dug' && this.inBox(p)) { this.brushing = true; this.brushAt(p); return; }
    if (w === 'lever') {
      const L = this.leverRect();
      if (p.x > L.x - 30 * u && p.x < L.x + L.w + 30 * u && p.y > L.y - 30 * u && p.y < L.y + L.h + 30 * u) { this.leverHeld = true; return; }
    }
    if ((w === 'compared' || w === 'fed') && Math.hypot(p.x - this.trayAt().x, p.y - this.trayAt().y) < 50 * u) {
      this.carry = { kind: w === 'fed' ? 'fern' : 'tooth', x: p.x, y: p.y };
      storySfx.pick();
      return;
    }
    if (w === 'picked' && this.glint) {
      const g = spot(this.view(), this.glint.x, this.glint.z);
      if (Math.hypot(p.x - g.x, p.y - g.y) < 70 * u) { this.flags.add('picked'); this.glint = null; storySfx.pick(); return; }
    }
    if (w === 'found' && this.beast) {
      const bs = this.beastScreen();
      if (bs.on && Math.hypot(p.x - bs.sx, p.y - bs.sy) < this.w * 0.35) { this.flags.add('found'); return; }
    }
    this.look.down(p.x);
  }

  private onMove(e: PointerEvent): void {
    const p = this.at(e);
    if (this.carry) { this.carry.x = p.x; this.carry.y = p.y; return; }
    if (this.brushing) { this.brushAt(p); return; }
    if (this.leverHeld) {
      const L = this.leverRect();
      this.lever = Math.max(0, Math.min(1, (p.y - L.y) / L.h));
      if (this.lever > 0.92 && !this.flags.has('lever')) { this.flags.add('lever'); storySfx.lever(); this.leverHeld = false; }
      return;
    }
    this.look.move(p.x);
  }

  private onUp(_e: PointerEvent): void {
    this.held = null;
    this.brushing = false;
    if (this.leverHeld) { this.leverHeld = false; if (!this.flags.has('lever')) this.lever = 0; }
    if (this.carry) { this.drop(this.carry); this.carry = null; }
    this.look.up();
  }

  private press(id: string): void {
    if (id === 'begin') { this.begin(); return; }
    if (id === 'again') { this.started = true; this.finished = false; this.enterChapter(0); return; }
  }

  private begin(): void {
    this.started = true;
    storySfx.pick();
    this.bedFor();
    this.runStep();
  }

  // ---------------------------------------------------------------- the garden

  private inBox(p: { x: number; y: number }): boolean {
    const b = this.boxRect();
    return p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h;
  }

  private brushAt(p: { x: number; y: number }): void {
    const b = this.boxRect(), cols = 12, rows = 6;
    const cx = Math.floor(((p.x - b.x) / b.w) * cols), cy = Math.floor(((p.y - b.y) / b.h) * rows);
    let fresh = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      if (!this.sand[y * cols + x]) { this.sand[y * cols + x] = true; fresh = true; }
    }
    if (fresh) {
      storySfx.brush();
      this.ps.spawn('dust', p.x, p.y, 3, { colour: '#d9c08a', speed: 80, spread: TAU, max: 0.6, grav: 200, size: 4 * this.u() });
    }
    const clean = this.sand.filter(Boolean).length / this.sand.length;
    if (clean > 0.6 && !this.flags.has('dug')) { this.flags.add('dug'); this.sand.fill(true); }
  }

  // ---------------------------------------------------------------- comparing and feeding

  private drop(c: Carry): void {
    const bs = this.beastScreen();
    const b = this.beast;
    if (!b || !bs.on) return;
    const v = this.view();
    const sp = spot(v, b.x, b.z, b.lift);
    // the head is well in front of the hips and well above the ground
    const facing = this.facingOf(b);
    const headX = sp.x + facing * sp.s * (b.kind === 'mosasaur' ? 6 : b.kind === 'trike' ? 3.5 : 2.4);
    const headY = sp.y - sp.s * (b.kind === 'mosasaur' ? 0 : b.kind === 'trike' ? 1.8 : 2.6);
    const close = Math.hypot(c.x - headX, c.y - headY) < Math.max(80 * this.u(), sp.s * 2.2);
    if (!close) return;
    if (c.kind === 'fern') {
      this.flags.add('fed');
      storySfx.munch();
      this.verdict = { t: 0, ok: true, x: headX, y: headY };
    } else {
      this.flags.add('compared');
      storySfx.wrong();
      this.verdict = { t: 0, ok: false, x: headX, y: headY };
    }
  }

  private facingOf(b: Beast): -1 | 1 {
    if (b.kind === 'trike') return b.x < 0 ? 1 : -1;
    const v = this.view();
    // which way it moves across the screen: sample a moment ahead
    let nx: number, nz: number;
    if (b.orbit) { const a = b.orbit.a + Math.sign(b.orbit.w) * 0.05; nx = Math.sin(a) * b.orbit.r; nz = Math.cos(a) * b.orbit.r; }
    else { nx = b.x + Math.sin(b.heading); nz = b.z + Math.cos(b.heading); }
    const now = spot(v, b.x, b.z), then = spot(v, nx, nz);
    return then.x >= now.x ? 1 : -1;
  }

  // ---------------------------------------------------------------- drawing

  private draw(): void {
    const ctx = this.ctx, u = this.u();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - 0.5) * this.shake * 14 * u, (Math.random() - 0.5) * this.shake * 10 * u);
    if (this.world === 'tunnel') this.drawTunnel();
    else this.drawWorld();
    this.ps.draw(ctx);
    ctx.restore();
    vignette(ctx, this.w, this.h, this.world === 'tunnel' ? 0.4 : 0.22);
    this.drawOverlay();
  }

  private palette(): Palette {
    return PALETTES[this.world === 'tunnel' ? 'garden' : this.world];
  }

  private drawWorld(): void {
    const ctx = this.ctx, u = this.u();
    const v = this.view();
    const pal = this.palette();
    drawBackdrop(ctx, v, pal, this.t);

    // everything standing in the world, far to near, the animal among them at its own distance
    type Item = { d: number; draw: () => void };
    const items: Item[] = [];
    for (const p of this.props) {
      const d = Math.hypot(p.x, p.z);
      items.push({ d, draw: () => drawProp(ctx, v, p, pal, this.t) });
    }
    if (this.beast) {
      const b = this.beast;
      items.push({ d: Math.hypot(b.x, b.z), draw: () => this.drawBeast(v, b, pal) });
    }
    if (this.world === 'garden') {
      items.push({ d: 3.2, draw: () => {
        const sp = spot(v, -1.1, 3.2);
        if (sp.on) drawGuide(ctx, sp.x, sp.y, sp.s * 0.75, { pose: this.flags.has('dug') ? 'cheer' : 'point', t: this.t, facing: 1, saying: isSpeaking() ? 0.5 + 0.5 * Math.sin(this.t * 12) : 0 });
      } });
    }
    if (this.glint) {
      const g = this.glint;
      items.push({ d: Math.hypot(g.x, g.z), draw: () => {
        const sp = spot(v, g.x, g.z);
        if (!sp.on) return;
        const r = sp.s * 0.35 * (1 + 0.2 * Math.sin(this.t * 6));
        const gl = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, r * 3);
        gl.addColorStop(0, 'rgba(255,250,210,0.95)'); gl.addColorStop(1, 'rgba(255,250,210,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(sp.x, sp.y, r * 3, 0, TAU); ctx.fill();
        this.drawTooth(sp.x, sp.y - r * 0.5, r * 1.6, -0.4);
      } });
    }
    items.sort((a, b) => b.d - a.d).forEach(i => i.draw());

    if (pal.water) {
      ctx.fillStyle = 'rgba(20, 90, 120, 0.18)';
      ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.world === 'garden') this.drawBox();
    // the hint: an arrow at the edge of the screen pointing the way round to the animal
    if (this.waiting() === 'found' && this.beast && this.lostT > 3.5) {
      const bs = this.beastScreen();
      if (!bs.on) {
        const a = wrapAngle(Math.atan2(this.beast.x, this.beast.z) - this.look.yaw);
        const left = a < 0;
        const x = left ? 26 * u : this.w - 26 * u, y = this.h * 0.45;
        ctx.save();
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.t * 5);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x + (left ? -12 : 12) * u, y);
        ctx.lineTo(x + (left ? 10 : -10) * u, y - 16 * u);
        ctx.lineTo(x + (left ? 10 : -10) * u, y + 16 * u);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawBeast(v: View, b: Beast, pal: Palette): void {
    const sp = spot(v, b.x, b.z, b.lift);
    if (!sp.on && Math.abs(sp.off) > (v.w / v.f) / 2 + 1.2) return;
    const facing = this.facingOf(b);
    const look: BeastLook = {
      facing, phase: b.phase, t: this.t, head: b.head,
      jaw: b.kind === 'trex' ? (this.sniffT > 0 ? 0.15 : 0.1 + 0.4 * Math.max(0, Math.sin(this.t * 0.7))) : 0,
      haze: pal.haze, hazeK: Math.min(0.6, Math.max(0, (sp.dist - 10) / 60)),
    };
    const ctx = this.ctx;
    if (b.kind === 'trex') drawTRex(ctx, sp.x, sp.y, sp.s, look);
    else if (b.kind === 'trike') drawTriceratops(ctx, sp.x, sp.y, sp.s, { ...look, phase: this.t * 0.05 });
    else if (b.kind === 'mammoth') drawMammoth(ctx, sp.x, sp.y, sp.s, look);
    else drawMosasaur(ctx, sp.x, sp.y, sp.s, look);
  }

  /** The old box from Grandpa's shed, with the tooth in the sand. */
  private drawBox(): void {
    const ctx = this.ctx, u = this.u();
    const b = this.boxRect();
    // the wooden box
    ctx.fillStyle = '#7a5232';
    ctx.beginPath(); ctx.roundRect(b.x - 12 * u, b.y - 12 * u, b.w + 24 * u, b.h + 24 * u, 8 * u); ctx.fill();
    ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 2 * u;
    for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(b.x - 12 * u, b.y - 12 * u + k * (b.h + 24 * u) / 4); ctx.lineTo(b.x + b.w + 12 * u, b.y - 12 * u + k * (b.h + 24 * u) / 4); ctx.stroke(); }
    // what is under the sand
    ctx.fillStyle = '#c9a868';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    this.drawTooth(b.x + b.w / 2, b.y + b.h * 0.55, Math.min(b.w * 0.3, b.h * 0.75), -1.2);
    // the sand still covering it, cell by cell, with soft edges
    const cols = 12, rows = 6, cw = b.w / cols, ch = b.h / rows;
    ctx.fillStyle = '#dcc288';
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (this.sand[y * cols + x]) continue;
      ctx.beginPath();
      ctx.ellipse(b.x + (x + 0.5) * cw, b.y + (y + 0.5) * ch, cw * 0.85, ch * 0.85, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(160, 120, 60, 0.35)';
    for (let i = 0; i < 40; i++) {
      const x = (Math.sin(i * 12.9) * 0.5 + 0.5) * b.w, y = (Math.sin(i * 78.2) * 0.5 + 0.5) * b.h;
      const cx = Math.floor((x / b.w) * cols), cy = Math.floor((y / b.h) * rows);
      if (this.sand[cy * cols + cx]) continue;
      ctx.beginPath(); ctx.arc(b.x + x, b.y + y, 1.6 * u, 0, TAU); ctx.fill();
    }
    if (this.shineT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.shineT);
      const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, 0, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.5);
      g.addColorStop(0, 'rgba(255,245,200,0.7)'); g.addColorStop(1, 'rgba(255,245,200,0)');
      ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.restore();
    }
    if (this.waiting() === 'dug') {
      // a hand showing the brushing, going back and forth over the sand
      const k = Math.sin(this.t * 2.4);
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x + b.w / 2 + k * b.w * 0.3, b.y + b.h * 0.45, 12 * u, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  /** A T. rex tooth: long, curved, pointed, with the root darker than the crown. */
  private drawTooth(x: number, y: number, len: number, rot: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const w = len * 0.28;
    const g = ctx.createLinearGradient(-w, 0, w, 0);
    g.addColorStop(0, '#b89a6a'); g.addColorStop(0.5, '#efe2c2'); g.addColorStop(1, '#a88a5a');
    ctx.fillStyle = '#8a6a44';
    ctx.beginPath(); ctx.roundRect(-w * 0.9, 0, w * 1.8, len * 0.35, w * 0.4); ctx.fill();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-w, 0);
    ctx.quadraticCurveTo(-w * 0.9, -len * 0.45, w * 0.35, -len * 0.65);
    ctx.quadraticCurveTo(w * 0.1, -len * 0.3, w, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(90, 60, 30, 0.35)'; ctx.lineWidth = Math.max(1, len * 0.012);
    ctx.beginPath(); ctx.moveTo(w * 0.85, -len * 0.05); ctx.quadraticCurveTo(w * 0.2, -len * 0.3, w * 0.33, -len * 0.62); ctx.stroke();
    ctx.restore();
  }

  private leverRect(): { x: number; y: number; w: number; h: number } {
    const u = this.u();
    return { x: this.w - 70 * u, y: this.h * 0.3, w: 34 * u, h: this.h * 0.32 };
  }

  /** The inside of the time drill: the rock rushing past a round window, and the gauge of years. */
  private drawTunnel(): void {
    const ctx = this.ctx, u = this.u();
    const { w, h } = this;
    ctx.fillStyle = '#120c08';
    ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.45;
    const going = !!this.tunnel;
    const dir = this.tunnel?.dir ?? 1;
    // Through the window: the layers of the ground, rushing up past you as the drill goes down.
    // Each band is one layer, and its colour comes from how old it is - sand and clay near the top,
    // grey and white chalk further down, red rock deeper still - so going back in time is seen as
    // well as counted. Fossils sit in the layers and go past with them.
    const R = Math.min(w, h) * 0.42;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    const age = Math.log10(this.years + 1);
    const depth = this.boreT * 900 * u * dir;
    const bandH = 30 * u;
    const first = Math.floor((depth - R) / bandH) - 1;
    const last = Math.ceil((depth + R) / bandH) + 1;
    for (let k = first; k <= last; k++) {
      const y = cy + (k * bandH - depth);
      const hsh = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1;
      const layerAge = age + (k * bandH - depth) / (bandH * 60);
      ctx.fillStyle = this.layerColour(layerAge, hsh);
      ctx.fillRect(cx - R, y, R * 2, bandH + 1);
      if (hsh > 0.6) { ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(cx - R, y, R * 2, Math.max(1, 1.5 * u)); }
      // pebbles and the odd fossil in the layer
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let q = 0; q < 5; q++) {
        const px = cx - R + ((hsh * 997 + q * 173) % 1000) / 1000 * R * 2;
        ctx.beginPath(); ctx.ellipse(px, y + bandH * 0.5, 4 * u + q, 2.5 * u, 0, 0, TAU); ctx.fill();
      }
      if (hsh > 0.8) {
        const fx = cx - R + ((hsh * 5000) % 1) * R * 2, fy = y + bandH * 0.5;
        ctx.strokeStyle = 'rgba(245, 232, 200, 0.85)';
        ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
        ctx.beginPath();
        if (hsh > 0.9) { ctx.arc(fx, fy, 9 * u, 0.3, 5.6); }
        else { ctx.moveTo(fx - 12 * u, fy); ctx.lineTo(fx + 12 * u, fy); ctx.moveTo(fx - 12 * u, fy - 4 * u); ctx.lineTo(fx - 12 * u, fy + 4 * u); ctx.moveTo(fx + 12 * u, fy - 4 * u); ctx.lineTo(fx + 12 * u, fy + 4 * u); }
        ctx.stroke();
      }
    }
    // speed streaks, and the glass: a highlight and a darker rim so it reads as a window
    if (going) {
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2 * u;
      for (let q = 0; q < 10; q++) {
        const x = cx - R + ((q * 0.61803) % 1) * R * 2, y0 = ((this.boreT * 1400 * u * dir + q * 97) % (R * 2) + R * 2) % (R * 2);
        ctx.beginPath(); ctx.moveTo(x, cy - R + y0); ctx.lineTo(x, cy - R + y0 - 60 * u * dir); ctx.stroke();
      }
    }
    const glass = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.5, R * 0.05, cx, cy, R);
    glass.addColorStop(0, 'rgba(255,255,255,0.22)'); glass.addColorStop(0.35, 'rgba(255,255,255,0.03)'); glass.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = glass; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.restore();

    // the cabin frame around the window
    ctx.save();
    ctx.fillStyle = '#e8a33c';
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.arc(cx, cy, Math.min(w, h) * 0.42, 0, TAU, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = '#8a5a1a'; ctx.lineWidth = 8 * u;
    ctx.beginPath(); ctx.arc(cx, cy, Math.min(w, h) * 0.42, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, rr = Math.min(w, h) * 0.46;
      ctx.fillStyle = '#6d4a1a';
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 4 * u, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // the gauge of years, big, over the top of the window
    const label = this.yearsLabel();
    // above the window when there is room, beside it on a phone turned sideways
    const wide = w > h;
    const lx = wide ? Math.max(90 * u, (cx - R) / 2 + 20 * u) : cx;
    const ly = wide ? cy : Math.max(60 * u, cy - R - 40 * u);
    ctx.textAlign = 'center';
    outlinedText(ctx, label, lx, ly, this.font('900', 24), '#fff6dc', 'rgba(40, 24, 10, 0.9)', 6);
    ctx.fillStyle = 'rgba(255, 246, 220, 0.8)';
    ctx.font = this.font('800', 12);
    ctx.fillText(T('years ago', 'jaar geleden'), lx, ly + 20 * u);

    // the handle, only while it is waiting to be pulled
    if (CHAPTERS[this.place.chapter].id === 'drill') {
      const L = this.leverRect();
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath(); ctx.roundRect(L.x + L.w * 0.35, L.y, L.w * 0.3, L.h, 6 * u); ctx.fill();
      const ky = L.y + this.lever * L.h;
      ctx.fillStyle = '#d0473a';
      ctx.beginPath(); ctx.arc(L.x + L.w / 2, ky, L.w * 0.7, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(L.x + L.w / 2 - L.w * 0.2, ky - L.w * 0.2, L.w * 0.25, 0, TAU); ctx.fill();
      if (this.waiting() === 'lever' && !this.leverHeld) {
        const k = (this.t * 0.8) % 1;
        ctx.save(); ctx.globalAlpha = 0.7 * (1 - k); ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(L.x + L.w / 2, L.y + k * L.h, 10 * u, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
  }

  /** The colour of a layer of rock of a given age (log10 of years): young at the top, old below. */
  private layerColour(age: number, jitter: number): string {
    const stops: Array<[number, [number, number, number]]> = [
      [0, [120, 86, 52]],     // soil
      [3, [176, 140, 92]],    // sand and clay
      [4.5, [150, 150, 140]], // ice-age gravel
      [6, [120, 110, 96]],
      [7.5, [228, 222, 200]], // chalk
      [7.9, [168, 88, 60]],   // red rock
      [9, [90, 60, 50]],
    ];
    let a = stops[0], b = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) if (age >= stops[i][0] && age <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
    if (age > stops[stops.length - 1][0]) a = b;
    const k = a === b ? 0 : (age - a[0]) / (b[0] - a[0]);
    const j = (jitter - 0.5) * 30;
    const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * k + j));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }

  private yearsLabel(): string {
    const y = this.years;
    const nl = NL();
    const fmt = (n: number): string => Math.round(n).toLocaleString(nl ? 'nl-NL' : 'en-GB');
    if (y < 1) return T('Now', 'Nu');
    if (y < 1000000) return fmt(y);
    const m = Math.round(y / 1000000);
    return nl ? `${m} miljoen` : `${m} million`;
  }

  // ---------------------------------------------------------------- the words and the buttons

  private drawOverlay(): void {
    const ctx = this.ctx, u = this.u();
    if (!this.started) {
      ctx.fillStyle = 'rgba(10, 20, 30, 0.35)';
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.textAlign = 'center';
      outlinedText(ctx, T('Suri and the giant tooth', 'Suri en de reuzentand'), this.w / 2, this.h * 0.3, this.font('900', 26), '#ffffff', 'rgba(20, 40, 60, 0.9)', 7);
      const bw = Math.min(240 * u, this.w - 60 * u), bh = 60 * u;
      this.button('begin', T('Start the story', 'Begin het verhaal'), (this.w - bw) / 2, this.h * 0.62, bw, bh, '#4fae6e', '#ffffff');
      return;
    }
    // the chapter's name, for a moment when it starts
    if (this.titleT > 0 && this.world !== 'tunnel') {
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.titleT);
      ctx.textAlign = 'center';
      outlinedText(ctx, NL() ? CHAPTERS[this.place.chapter].titleNl : CHAPTERS[this.place.chapter].title, this.w / 2, 40 * u, this.font('900', 20), '#ffffff', 'rgba(20, 40, 60, 0.85)', 6);
      ctx.restore();
    }
    // the years, small, whenever we are somewhere in the past
    if (this.world !== 'tunnel' && this.world !== 'garden') {
      ctx.textAlign = 'center';
      outlinedText(ctx, `${this.yearsLabel()} ${T('years ago', 'jaar geleden')}`, this.w / 2, 64 * u, this.font('800', 12), '#ffffff', 'rgba(20, 40, 60, 0.8)', 4);
    }
    // what Ruth is saying, written underneath for a parent reading along
    if (this.line) {
      const bx = Math.max(GUIDE_KEEP, 14 * u), bw = this.w - bx - 14 * u;
      ctx.font = this.font('800', 13);
      const lines = this.wrap(this.line, bw - 28 * u).slice(0, 3);
      const bh = 22 * u + lines.length * 17 * u;
      const by = this.h - bh - 14 * u;
      glassPanel(ctx, bx, by, bw, bh, 16 * u, 0.9);
      ctx.fillStyle = '#123047';
      ctx.textAlign = 'center';
      lines.forEach((l, i) => ctx.fillText(l, bx + bw / 2, by + 26 * u + i * 17 * u));
    }
    // the thing to carry, waiting at the side
    const w = this.waiting();
    if ((w === 'compared' || w === 'fed') && !this.carry) {
      const tr = this.trayAt();
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(tr.x, tr.y, 38 * u * (1 + 0.05 * Math.sin(this.t * 4)), 0, TAU); ctx.fill();
      ctx.restore();
      if (w === 'fed') this.drawFern(tr.x, tr.y + 20 * u, 44 * u);
      else this.drawTooth(tr.x, tr.y + 14 * u, 50 * u, -0.3);
    }
    if (this.carry) {
      if (this.carry.kind === 'fern') this.drawFern(this.carry.x, this.carry.y + 20 * u, 56 * u);
      else this.drawTooth(this.carry.x, this.carry.y + 16 * u, 64 * u, -0.3);
    }
    if (this.verdict) {
      const k = this.verdict.t;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k / 1.6);
      ctx.strokeStyle = this.verdict.ok ? '#6fdc8c' : '#ff7a6a';
      ctx.lineWidth = 7 * u; ctx.lineCap = 'round';
      const { x, y } = this.verdict, r = 26 * u;
      ctx.beginPath();
      if (this.verdict.ok) { ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.3, y + r * 0.7); ctx.lineTo(x + r, y - r * 0.6); }
      else { ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); }
      ctx.stroke();
      ctx.restore();
    }
    // the two teeth held together, and the match
    if (this.matchT >= 0 && this.matchT < 6) {
      const k = Math.min(1, this.matchT / 1.2);
      const cx = this.w / 2, cy = this.h * 0.42;
      ctx.fillStyle = `rgba(10, 20, 30, ${0.45 * Math.min(1, this.matchT * 2)})`;
      ctx.fillRect(0, 0, this.w, this.h);
      this.drawTooth(cx - (1 - k) * 90 * u - 18 * u, cy + 40 * u, 110 * u, -0.1);
      this.drawTooth(cx + (1 - k) * 90 * u + 18 * u, cy + 40 * u, 110 * u, -0.1);
      if (k >= 1 && this.matchT < 1.3) {
        storySfx.match();
        this.ps.spawn('spark', cx, cy, 24, { colour: '#ffe79a', speed: 240, size: 8 * u, max: 1, spread: TAU });
        this.matchT = 1.3;
      }
    }
    if (this.finished) {
      const bw = Math.min(220 * u, this.w - 80 * u), bh = 56 * u;
      this.button('again', T('Again', 'Nog een keer'), (this.w - bw) / 2, this.h * 0.2, bw, bh, '#4fae6e', '#ffffff');
    }
  }

  private drawFern(x: number, y: number, s: number): void {
    const ctx = this.ctx;
    ctx.strokeStyle = '#4f8a36'; ctx.lineWidth = Math.max(2, s * 0.06); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + s * 0.1, y - s * 0.6, x - s * 0.1, y - s); ctx.stroke();
    for (let k = 1; k < 8; k++) {
      const f = k / 8, px = x + s * 0.05 * Math.sin(f * 3), py = y - s * f;
      const l = s * 0.35 * (1 - f * 0.6);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - l, py - l * 0.3); ctx.moveTo(px, py); ctx.lineTo(px + l, py - l * 0.3); ctx.stroke();
    }
  }

  private wrap(text: string, maxW: number): string[] {
    const ctx = this.ctx;
    const out: string[] = [];
    let cur = '';
    for (const word of text.split(' ')) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = word; } else cur = test;
    }
    if (cur) out.push(cur);
    return out;
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fffdf6', ink = '#25506e'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', 16);
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, face.y + h * 0.62, w - 16);
    this.hits.push({ id, x, y, w, h });
  }
}

export type { Chapter };
