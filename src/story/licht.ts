/**
 * Suri en het lichtje in de diepte - the deep-sea story, on the shared stage (`stage.ts`).
 *
 * The script is in `lichtscript.ts`. What is particular to this story is here: the ship's deck at
 * dusk with the camera's screen, and then one continuous sea under it. The sea is not a set of
 * separate scenes but a depth: the colour of the water, how much daylight comes down, what lives
 * there and how dark it is are all worked out from how deep the submarine is, so the child who holds
 * the button sees the reef fade into the blue above them, the lanternfish come out, and the black
 * close in. At the bottom it is dark enough that the only things you see are the lights the animals
 * make themselves, and the one the lamps make where you point them.
 */

import { NL, T } from '../util/lang';
import { ASIDES, CHAPTERS, DEPTH, ZONE_NAMES, zoneAt, type Chapter } from './lichtscript';
import { TAU } from './look';
import { EYE, scatter, screenX, spot, type Palette, type View } from './world';
import { drawAnglerfish, drawCoral, drawLureGlow, drawSpermWhale, drawTurtle, lurePoint, type CoralKind, type SeaLook } from './seaart';
import { bed, lichtSfx, type Bed } from './lichtsfx';
import { Life } from './life';
import { Stage, type Beast, type Pt } from './stage';

type World = 'surface' | 'sea';

interface Coral { kind: CoralKind; x: number; z: number; size: number; seed: number }
interface Flake { a: number; e: number; r: number; seed: number }

/**
 * The colour of the water by depth. Red goes first and blue last, so the sea gets bluer and then
 * darker; below a thousand metres there is no daylight at all and the water is black.
 */
const WATER: Array<[number, string, string, string, number]> = [
  // depth, top of the view, bottom of the view, haze, daylight
  [0, '#4bb3d3', '#1f7aa0', '#3a93b8', 1],
  [15, '#3aa0c4', '#136186', '#2a82a8', 0.85],
  [60, '#23779c', '#0c4768', '#1b6488', 0.6],
  [200, '#0f4466', '#062b48', '#0b3857', 0.25],
  [500, '#0a2b47', '#04172d', '#061d36', 0.06],
  [1000, '#030b18', '#01060e', '#020a16', 0],
  [1500, '#01040a', '#000206', '#01050b', 0],
];

function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number): number => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

function waterAt(depth: number): { top: string; low: string; haze: string; light: number } {
  for (let i = 1; i < WATER.length; i++) {
    const [d1, t1, l1, h1, g1] = WATER[i];
    const [d0, t0, l0, h0, g0] = WATER[i - 1];
    if (depth <= d1) {
      const k = Math.max(0, (depth - d0) / (d1 - d0));
      return { top: mix(t0, t1, k), low: mix(l0, l1, k), haze: mix(h0, h1, k), light: g0 + (g1 - g0) * k };
    }
  }
  const [, t, l, h] = WATER[WATER.length - 1];
  return { top: t, low: l, haze: h, light: 0 };
}

/** How black it is at a depth, 0..1: a dim blue at five hundred metres, nothing below twelve hundred. */
const darkAt = (depth: number): number => Math.max(0, Math.min(1, (depth - 300) / 900)) * 0.97;

const DUSK: Palette = {
  skyTop: '#1b2a55', skyLow: '#f3a071', sun: '#ffd9a0', sunAt: 0.6, sunUp: 0.03,
  cloud: '#f4b8a0', clouds: 4, far: '#284f73', mid: '#284f73', ground: '#2c5578', groundNear: '#0f2c48', haze: '#e8a584',
  bare: true,
};
const NIGHT: Palette = {
  skyTop: '#050a1c', skyLow: '#1c2c50', sun: '#dfe8ff', sunAt: 0.45, sunUp: 0.5,
  cloud: '#2a3656', clouds: 3, far: '#0c1a2e', mid: '#0c1a2e', ground: '#12243c', groundNear: '#08121f', haze: '#23355a',
  bare: true,
};

export class Licht extends Stage {
  protected readonly id = 'lichtje';
  protected readonly chapters: Chapter[] = CHAPTERS;
  protected readonly title = { en: 'Suri and the light in the deep', nl: 'Suri en het lichtje in de diepte' };
  protected readonly lookAround = ASIDES.lookAround;

  private world: World = 'surface';
  private night = false;
  private depth = 0;
  private corals: Coral[] = [];
  private flakes: Flake[] = [];

  // the camera's screen on the ship
  private screenOn = false;
  private spottedT = 0;

  // moving: by the child holding the button, or on its own (going under, coming back up)
  private dive: { from: number; to: number } | null = null;
  private auto: { from: number; to: number; t: number; dur: number; then: () => void } | null = null;
  private idleT = 0;
  private nagged = false;
  private sinkRate = 0;

  private lamps = false;
  private lampK = 0;
  private revealT = -1;
  private flashT = 0;
  private playing: Bed | null = null;
  private motor = false;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    // marine snow: flakes at fixed places round you, which drift down, and stream past when you move
    for (let i = 0; i < 160; i++) this.flakes.push({ a: Math.random() * TAU, e: Math.random() * 2 - 1, r: 0.5 + Math.random() * 1.5, seed: Math.random() });
    this.run();
  }

  protected debugExtra(): Record<string, unknown> {
    return { world: this.world, depth: Math.round(this.depth), lamps: this.lamps, screen: this.screenOn };
  }

  /** The camera screen on the ship: where it is, and where the blinking light is on it. */
  screenRect(): { x: number; y: number; w: number; h: number; lx: number; ly: number } {
    const u = this.u();
    const sw = Math.min(this.w - 40 * u, 320 * u, this.h * 0.7), sh = sw * 0.56;
    const x = (this.w - sw) / 2, y = Math.min(90 * u, this.h * 0.2);
    return { x, y, w: sw, h: sh, lx: x + sw * 0.64, ly: y + sh * 0.58 };
  }

  /** The one button in the corner: hold it to sink, or tap it for the lamps. */
  private sideButton(): { x: number; y: number; w: number; h: number } {
    const u = this.u();
    const bw = 150 * u, bh = 62 * u;
    return { x: this.w - bw - 16 * u, y: this.h - 87 * u - bh - 18 * u, w: bw, h: bh };
  }

  protected view(): View {
    const v = super.view();
    // on deck, the ship rolls a little on the swell
    if (this.world === 'surface') v.horizon += Math.sin(this.t * 0.7) * 7 * this.u();
    return v;
  }

  protected palette(): Palette {
    if (this.world === 'surface') return this.night ? NIGHT : DUSK;
    const wv = waterAt(this.depth);
    return {
      skyTop: wv.top, skyLow: wv.low, sun: '#bfeaf5', sunAt: 0, sunUp: 1, cloud: '#9fd8e8', clouds: 0,
      far: mix(wv.low, '#1c4a60', 0.4), mid: mix(wv.low, '#245a70', 0.5), ground: '#cdbb8c', groundNear: '#a8966a', haze: wv.haze,
      water: true, midwater: this.corals.length === 0, light: wv.light,
    };
  }

  protected gauge(): string {
    if (this.world === 'surface') return '';
    const z = ZONE_NAMES[zoneAt(this.depth)];
    return `${Math.round(this.depth)} ${T('metres deep', 'meter diep')} · ${NL() ? z.nl : z.en}`;
  }

  // ---------------------------------------------------------------- chapters and cues

  protected setup(c: Chapter): void {
    this.dive = null;
    this.auto = null;
    this.revealT = -1;
    this.flashT = 0;
    this.idleT = 0; this.nagged = false;
    if (c.id === 'boat') {
      this.world = 'surface'; this.night = false; this.depth = 0;
      this.screenOn = false; this.spottedT = 0;
      this.corals = []; this.props = []; this.beast = null; this.life = null;
      this.lamps = false; this.lampK = 0;
    } else if (c.id === 'reef') this.buildReef();
    else if (c.id === 'twilight') { this.toDepth(DEPTH.twilight); this.beast = null; }
    else if (c.id === 'dark') { this.toDepth(DEPTH.dark); this.beast = null; this.lamps = false; }
    else if (c.id === 'angler') { this.toDepth(DEPTH.angler); this.lamps = false; this.buildAngler(); }
    else if (c.id === 'up') { this.lamps = false; if (this.world === 'surface') this.toDepth(DEPTH.angler); }
  }

  protected cue(name: string): void {
    const u = this.u();
    if (name === 'screen') this.screenOn = true;
    else if (name === 'submerge') {
      this.screenOn = false;
      lichtSfx.splash();
      this.shake = 0.5;
      this.flashT = 1;
      this.world = 'sea';
      this.depth = 2;
      this.buildReef(false);
      this.moveAuto(2, DEPTH.reef, 4.5, () => this.flags.add('arrived'));
    } else if (name === 'whale') this.whaleArrives();
    else if (name === 'reveal') {
      this.revealT = 0;
      lichtSfx.reveal();
      if (this.beast) this.turnTo(Math.atan2(this.beast.x, this.beast.z), 2.5);
      const g = this.lure();
      if (g) this.ps.spawn('spark', g.x, g.y, 16, { colour: '#b8f6ff', speed: 90, size: 5 * u, max: 1, spread: TAU });
    } else if (name === 'ascend') {
      this.lamps = false;
      this.beast = null;
      this.moveAuto(this.depth, 0, 9, () => {
        this.world = 'surface'; this.night = true;
        this.life = null; this.corals = []; this.props = [];
        lichtSfx.arrive();
        this.flashT = 1;
        this.flags.add('arrived');
      });
    } else if (name === 'end') { lichtSfx.done(); this.finished = true; this.markSeen(); }
  }

  protected ambience(): void {
    if (!this.started) return;
    const want: Bed = this.world === 'surface' ? 'surface' : this.depth < 200 ? 'reef' : 'deep';
    const motor = !!this.auto || (this.held === 'down' && !!this.dive);
    if (want === this.playing && motor === this.motor) return;
    this.playing = want; this.motor = motor;
    bed(want, motor);
  }

  destroy(): void { super.destroy(); bed(null); }

  protected onFound(b: Beast): void {
    if (b.kind === 'whale') lichtSfx.clicks();
  }

  // ---------------------------------------------------------------- the places

  private buildReef(withTurtle = true): void {
    this.world = 'sea';
    if (this.depth < 1 || this.depth > 60) this.depth = DEPTH.reef;
    this.life = new Life('reef', 12);
    // the reef round you: corals, sponges and anemones on the sand, with rocks and weed between
    const r = ((a: number) => () => { a = (a * 16807) % 2147483647; return a / 2147483647; })(97);
    const kinds: CoralKind[] = ['branch', 'brain', 'fan', 'tube', 'branch', 'tube', 'brain', 'anemone'];
    this.corals = [];
    for (let i = 0; i < 170; i++) {
      const a = r() * TAU, d = 1.8 + Math.pow(r(), 1.3) * 18;
      // leave the view straight ahead open near by, so the first look is out over the reef
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.3 && d < 4) continue;
      // a coral head is about as big as a child, a sea fan taller; the far ones are bigger mounds
      const size = d < 4 ? 0.7 + r() * 0.6 : d < 10 ? 1.2 + r() * 1.2 : 2 + r() * 1.6;
      this.corals.push({ kind: kinds[i % kinds.length], x: Math.sin(a) * d, z: Math.cos(a) * d, size, seed: i });
    }
    this.props = scatter(51, [['rock', 26, 1.3], ['weed', 30, 1.2], ['shell', 30, 1]], 0.3, 8);
    this.beast = withTurtle
      ? { kind: 'turtle', x: 0, z: 0, speed: 0.6, heading: 0, orbit: { r: 4.2, a: Math.PI * 0.8, w: 0.6 / 4.2 }, phase: 0, stride: 1.3, head: 0, jaw: 0, lift: 1.7 }
      : null;
  }

  /** Straight to a depth, for a jump or the start of a chapter: the life and the reef that go with it. */
  private toDepth(d: number): void {
    this.world = 'sea';
    this.depth = d;
    this.corals = []; this.props = [];
    this.life = new Life(d >= 1000 ? 'deep' : d >= 200 ? 'twilight' : 'reef', 13 + Math.round(d));
  }

  private whaleArrives(): void {
    // from behind you, going round in a wide slow circle, a little above
    const a = this.look.yaw + Math.PI * 0.85;
    this.beast = { kind: 'whale', x: 0, z: 0, speed: 1.6, heading: 0, orbit: { r: 19, a, w: 1.6 / 19 }, phase: 0, stride: 6, head: 0, jaw: 0, lift: 2.4 };
  }

  private buildAngler(): void {
    // just within arm's length, behind you and to the left, level with your eyes: she is small
    const a = -2.3, d = 0.7;
    this.beast = { kind: 'angler', x: Math.sin(a) * d, z: Math.cos(a) * d, speed: 0, heading: 0, phase: 0, stride: 1, head: 0, jaw: 0, lift: EYE - 0.05 };
  }

  private moveAuto(from: number, to: number, dur: number, then: () => void): void {
    this.auto = { from, to, t: 0, dur, then };
  }

  // ---------------------------------------------------------------- per frame

  protected tick(dt: number): void {
    const u = this.u();
    this.flashT = Math.max(0, this.flashT - dt * 0.8);
    this.lampK += ((this.lamps ? 1 : 0) - this.lampK) * Math.min(1, dt * 6);
    if (this.spottedT > 0) this.spottedT -= dt;
    if (this.revealT >= 0) this.revealT += dt;
    const was = this.depth;

    if (this.auto) {
      const a = this.auto;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur), e = k * k * (3 - 2 * k);
      this.depth = a.from + (a.to - a.from) * e;
      if (k >= 1) { this.auto = null; a.then(); this.look.reset(); }
    }

    // holding the button: the submarine sinks, slowly at first, and the gauge counts
    if (this.waiting() === 'deeper') {
      if (!this.dive) this.dive = { from: this.depth, to: this.chapterId() === 'reef' ? DEPTH.twilight : DEPTH.dark };
      if (this.held === 'down') {
        this.sinkRate = Math.min(1, this.sinkRate + dt * 0.8);
        const span = this.dive.to - this.dive.from;
        this.depth = Math.min(this.dive.to, this.depth + (span / 7) * this.sinkRate * dt);
        this.idleT = 0;
        if (this.depth >= this.dive.to) { this.flags.add('deeper'); this.sinkRate = 0; }
      } else {
        this.sinkRate = 0;
        this.idleT += dt;
        if (this.depth > this.dive.from + 5 && this.idleT > 3 && !this.nagged) { this.nagged = true; this.aside(ASIDES.holdOn); }
      }
    }

    this.passThrough(was, this.depth);
    if (this.depth !== was) this.stream(this.depth - was, dt);
    if (this.beast) this.updateBeast(dt, this.depth - was);
    this.ambience();

    // a slow drift of bubbles up past the window whenever the submarine is under water
    if (this.world === 'sea' && Math.random() < dt * 3) {
      this.ps.spawn('dust', Math.random() * this.w, this.h + 10, 1, { colour: 'rgba(220,245,255,0.7)', speed: 50, spread: 0.3, max: 5, grav: -40, size: (2 + Math.random() * 3) * u });
    }
  }

  /** Going down or up through the zones: the reef fades into the blue, the life changes. */
  private passThrough(from: number, to: number): void {
    if (from === to || this.world !== 'sea') return;
    if (to > 60 && this.corals.length) { this.corals = []; this.props = []; }
    const kind = (d: number): string => (d >= 1000 ? 'deep' : d >= 200 ? 'twilight' : 'reef');
    if (kind(from) !== kind(to)) this.life = new Life(kind(to) as 'deep' | 'twilight' | 'reef', 20 + Math.round(to));
  }

  /** Moving: bubbles and snow stream past the other way, which is what makes it feel like moving. */
  private stream(dd: number, dt: number): void {
    const v = this.view();
    for (const f of this.flakes) {
      f.e -= (dd / 40) * f.r;
      if (f.e < -1) f.e += 2; else if (f.e > 1) f.e -= 2;
    }
    const speed = Math.abs(dd / dt);
    if (Math.random() < dt * Math.min(30, speed * 0.3)) {
      const up = dd > 0;
      this.ps.spawn('dust', Math.random() * v.w, up ? v.h + 10 : -10, 1, { colour: 'rgba(220,245,255,0.8)', speed: 60, spread: 0.2, max: 2, grav: up ? -500 : 500, size: (2 + Math.random() * 3) * this.u() });
    }
  }

  private updateBeast(dt: number, dd: number): void {
    const b = this.beast!;
    if (b.orbit) {
      b.orbit.a += b.orbit.w * dt;
      b.x = Math.sin(b.orbit.a) * b.orbit.r;
      b.z = Math.cos(b.orbit.a) * b.orbit.r;
      b.phase += (b.speed * dt) / b.stride;
    }
    if (b.kind === 'turtle') {
      // sinking away from the reef, the turtle stays up there in the light
      b.lift += dd;
      b.phase += dt * 0.25;
    } else if (b.kind === 'whale') {
      // diving with you: nose down while you follow, level again when you stop
      const diving = this.held === 'down' && dd > 0;
      b.head += ((diving ? 0.35 : 0) - b.head) * Math.min(1, dt * 1.5);
      if (this.chapterId() !== 'twilight') b.lift -= dt * 3;
    } else if (b.kind === 'angler') {
      // hanging almost still in the water, drifting a hand's width this way and that
      b.phase += dt * 0.6;
      b.lift = EYE - 0.05 + Math.sin(this.t * 0.7) * 0.02;
    }
  }

  // ---------------------------------------------------------------- the child's hands

  protected down(p: Pt): boolean {
    const w = this.waiting();
    const u = this.u();
    if (this.screenOn && w === 'spotted') {
      const s = this.screenRect();
      if (p.x > s.x - 10 * u && p.x < s.x + s.w + 10 * u && p.y > s.y - 10 * u && p.y < s.y + s.h + 10 * u) {
        this.flags.add('spotted');
        this.spottedT = 1;
        lichtSfx.spotted();
        this.ps.spawn('spark', s.lx, s.ly, 14, { colour: '#b8f6ff', speed: 110, size: 5 * u, max: 0.8, spread: TAU });
        return true;
      }
    }
    if (w === 'parted' && this.life) {
      const v = this.view();
      const angle = v.yaw + (p.x - this.w / 2) / v.f;
      if (this.life.part(angle) > 0) {
        this.flags.add('parted');
        lichtSfx.swish();
        return true;
      }
    }
    return false;
  }

  protected press(id: string): void {
    if (id === 'lamp') {
      this.lamps = !this.lamps;
      lichtSfx.lamp();
      this.flags.add(this.lamps ? 'lamps' : 'dark');
      return;
    }
    super.press(id);
  }

  // ---------------------------------------------------------------- drawing

  private lure(): { x: number; y: number } | null {
    const b = this.beast;
    if (!b || b.kind !== 'angler') return null;
    const v = this.view();
    const sp = spot(v, b.x, b.z, b.lift);
    if (!sp.on) return null;
    return lurePoint(sp.x, sp.y, sp.s, { facing: this.facingOf(b), phase: b.phase, t: this.t });
  }

  protected facingOf(b: Beast): -1 | 1 {
    // the anglerfish faces you across the view, towards the middle of the screen
    if (b.kind === 'angler') { const bs = this.beastScreen(); return bs.sx < this.w / 2 ? 1 : -1; }
    return super.facingOf(b);
  }

  protected drawBeast(v: View, b: Beast): void {
    const sp = spot(v, b.x, b.z, b.lift);
    if (!sp.on && Math.abs(sp.off) > (v.w / v.f) / 2 + 1.5) return;
    const look: SeaLook = { facing: this.facingOf(b), phase: b.phase, t: this.t, pitch: b.head };
    const ctx = this.ctx;
    ctx.save();
    if (b.kind === 'turtle') drawTurtle(ctx, sp.x, sp.y, sp.s, look);
    else if (b.kind === 'whale') drawSpermWhale(ctx, sp.x, sp.y, sp.s, look);
    else if (b.kind === 'angler') drawAnglerfish(ctx, sp.x, sp.y, sp.s, look, this.lampK);
    ctx.restore();
  }

  protected worldItems(v: View): Array<{ d: number; draw: () => void }> {
    const ctx = this.ctx;
    const out: Array<{ d: number; draw: () => void }> = [];
    for (const c of this.corals) {
      out.push({ d: Math.hypot(c.x, c.z), draw: () => {
        const sp = spot(v, c.x, c.z);
        if (sp.on) drawCoral(ctx, sp.x, sp.y, sp.s, c.kind, c.seed, this.t, c.size);
      } });
    }
    return out;
  }

  protected drawOver(v: View, pal: Palette): void {
    const ctx = this.ctx, u = this.u();
    if (this.world === 'surface') { this.drawDeck(v); return; }
    // leaving the reef: it fades into the blue above you
    const fade = Math.max(0, Math.min(1, (this.depth - 15) / 45));
    if (this.corals.length && fade > 0) { ctx.fillStyle = pal.skyLow; ctx.globalAlpha = fade; ctx.fillRect(0, 0, this.w, this.h); ctx.globalAlpha = 1; }
    this.drawDark();
    this.drawSnow(v);
    // the lights the animals make, over the dark
    const dk = Math.max(0.35, darkAt(this.depth) / 0.97);
    this.life?.drawGlows(ctx, v, this.depth > 200 ? Math.max(0.8, dk) : 0);
    const g = this.lure();
    if (g) {
      // the lure blinks: a slow pulse, and now and then off altogether
      const cyc = (this.t % 2.6) / 2.6;
      const k = cyc < 0.7 ? 0.65 + 0.35 * Math.sin(cyc * 12) : 0.1;
      drawLureGlow(ctx, g.x, g.y, Math.max(44 * u, this.view().f / 18), k);
    }
    if (this.flashT > 0) { ctx.fillStyle = `rgba(210, 240, 255, ${this.flashT * 0.6})`; ctx.fillRect(0, 0, this.w, this.h); }
  }

  /**
   * Marine snow: specks drifting down. Drawn over the dark, because it is only seen where there is
   * light on it: faintly in the last of the daylight, brightly in the lamps.
   */
  private drawSnow(v: View): void {
    if (this.depth < 120) return;
    const ctx = this.ctx, u = this.u();
    const day = Math.min(1, (this.depth - 120) / 300) * (1 - darkAt(this.depth));
    const cx = this.w / 2, cy = this.h * 0.5, R = Math.max(this.w, this.h) * 0.42;
    for (const f of this.flakes) {
      f.e += 0.00015 * f.r;
      const x = screenX(v, f.a) + Math.sin(this.t * 0.3 + f.seed * 20) * 3;
      if (x < -5 || x > v.w + 5) continue;
      const y = v.h / 2 - f.e * v.h * 0.6 + Math.sin(this.t * 0.5 + f.seed * 9) * 4;
      const inLamp = this.lampK * Math.max(0, 1 - Math.hypot(x - cx, y - cy) / R);
      const k = 0.35 * day + 0.9 * inLamp;
      if (k < 0.02) continue;
      ctx.fillStyle = `rgba(230, 240, 235, ${k})`;
      ctx.beginPath(); ctx.arc(x, y, f.r * 1.1 * u, 0, TAU); ctx.fill();
    }
  }

  /** The dark of the deep, and the hole the lamps make in it where you look. */
  private drawDark(): void {
    const ctx = this.ctx;
    const a = darkAt(this.depth);
    if (a <= 0.01) return;
    const cx = this.w / 2, cy = this.h * 0.5, R = Math.max(this.w, this.h) * 0.42;
    if (this.lampK > 0.01) {
      const inner = a * (1 - this.lampK * 0.93);
      const g = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
      g.addColorStop(0, `rgba(0, 3, 8, ${inner})`);
      g.addColorStop(0.55, `rgba(0, 3, 8, ${inner + (a - inner) * 0.35})`);
      g.addColorStop(1, `rgba(0, 3, 8, ${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
      // the light scattering in the water in front of the lamps: a soft blue-white glow
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
      sg.addColorStop(0, `rgba(120, 165, 210, ${0.22 * this.lampK})`);
      sg.addColorStop(1, 'rgba(150, 190, 230, 0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, 0, this.w, this.h);
      ctx.restore();
    } else {
      ctx.fillStyle = `rgba(0, 3, 8, ${a})`;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }

  /** On deck: glints on the water, the rail in front of you, and the cable going down. */
  private drawDeck(v: View): void {
    const ctx = this.ctx, u = this.u();
    const hz = v.horizon;
    // the low sun's path on the water, and glints on every wave
    const sx = screenX(v, (this.night ? NIGHT : DUSK).sunAt);
    for (let k = 0; k < 40; k++) {
      const y = hz + (this.h - hz) * Math.pow(k / 40, 1.8) + 2;
      const spread = 8 + (y - hz) * 0.5;
      const wob = Math.sin(this.t * 1.5 + k * 1.7) * spread * 0.3;
      ctx.fillStyle = this.night ? 'rgba(220, 230, 255, 0.18)' : 'rgba(255, 210, 160, 0.4)';
      ctx.fillRect(sx - spread / 2 + wob, y, spread * (0.3 + 0.3 * Math.sin(k * 3.1)), Math.max(1, (y - hz) * 0.03));
    }
    ctx.strokeStyle = this.night ? 'rgba(180, 200, 255, 0.12)' : 'rgba(255, 220, 190, 0.18)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 16; k++) {
      const y = hz + (this.h - hz) * Math.pow(k / 16, 1.7) + 4;
      ctx.beginPath();
      for (let x = 0; x <= this.w; x += 10) {
        const a = v.yaw + (x - this.w / 2) / v.f;
        const yy = y + Math.sin(a * 14 + this.t * 1.1 + k * 2) * (1 + k * 0.5);
        if (x) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
    if (this.night) {
      // the stars, fixed in the sky as you turn, and the moon
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 160; i++) {
        const a = (i * 2.399) % TAU, e = 0.04 + ((i * 0.618) % 1) * 0.75;
        const x = screenX(v, a);
        if (x < 0 || x > this.w) continue;
        const tw = 0.5 + 0.5 * Math.sin(this.t * 2 + i);
        ctx.globalAlpha = 0.4 + 0.5 * tw;
        ctx.beginPath(); ctx.arc(x, hz - e * v.f, (0.9 + (i % 3) * 0.5) * u, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const mx = screenX(v, NIGHT.sunAt), my = hz - 0.45 * v.f;
      ctx.fillStyle = '#f4f1e0';
      ctx.beginPath(); ctx.arc(mx, my, 16 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200, 195, 170, 0.5)';
      ctx.beginPath(); ctx.arc(mx - 5 * u, my - 3 * u, 3.5 * u, 0, TAU); ctx.arc(mx + 4 * u, my + 5 * u, 2.5 * u, 0, TAU); ctx.fill();
    }
    // the cable, from the crane over the side down into the water
    const cx = screenX(v, 0.35);
    if (cx > -50 && cx < this.w + 50) {
      ctx.strokeStyle = 'rgba(30, 30, 35, 0.8)'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(cx + 40 * u, -10); ctx.quadraticCurveTo(cx + 10 * u, hz * 0.6, cx, hz + 40 * u); ctx.stroke();
    }
    // the ship's rail across the bottom of the view
    const ry = this.h * 0.72;
    ctx.fillStyle = this.night ? '#1d2430' : '#39424f';
    ctx.fillRect(0, ry + 34 * u, this.w, this.h - ry);
    ctx.strokeStyle = this.night ? '#8a93a3' : '#e9ecef';
    ctx.lineWidth = 5 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(this.w, ry); ctx.stroke();
    ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.moveTo(0, ry + 17 * u); ctx.lineTo(this.w, ry + 17 * u); ctx.stroke();
    const step = 70 * u, off = ((-v.yaw * v.f) % step + step) % step;
    for (let x = off - step; x < this.w + step; x += step) { ctx.beginPath(); ctx.moveTo(x, ry); ctx.lineTo(x, ry + 34 * u); ctx.stroke(); }
  }

  protected drawUi(): void {
    const ctx = this.ctx, u = this.u();
    if (this.screenOn) this.drawScreen();
    const w = this.waiting();
    const b = this.sideButton();
    if (w === 'deeper') {
      const pulse = this.held === 'down' ? 0 : Math.sin(this.t * 4) * 0.5 + 0.5;
      ctx.save();
      ctx.globalAlpha = 0.25 * pulse;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.roundRect(b.x - 6 * u, b.y - 6 * u, b.w + 12 * u, b.h + 12 * u, 22 * u); ctx.fill();
      ctx.restore();
      this.button('down', T('Down', 'Omlaag'), b.x, b.y, b.w, b.h, '#3d8fd1', '#ffffff');
    } else if (this.chapterId() === 'dark' || (this.chapterId() === 'angler' && (w !== 'found' || this.lamps))) {
      this.button('lamp', this.lamps ? T('Lamp off', 'Lamp uit') : T('Lamp on', 'Lamp aan'), b.x, b.y, b.w, b.h, this.lamps ? '#f2c14e' : '#fffdf6', '#25506e');
    }
    // the moment she is seen: her name, small, under her
    if (this.revealT > 0 && this.revealT < 6 && this.beast?.kind === 'angler') {
      const bs = this.beastScreen();
      ctx.save();
      ctx.globalAlpha = Math.min(1, this.revealT) * Math.min(1, 6 - this.revealT);
      ctx.textAlign = 'center';
      ctx.font = this.font('900', 15);
      ctx.fillStyle = '#e8fbff';
      ctx.fillText(T('anglerfish', 'hengelaarsvis'), bs.sx, bs.sy + 70 * u);
      ctx.restore();
    }
  }

  /** The ship's monitor: what the camera on the cable sees, far down. */
  private drawScreen(): void {
    const ctx = this.ctx, u = this.u();
    const s = this.screenRect();
    ctx.fillStyle = '#20252c';
    ctx.beginPath(); ctx.roundRect(s.x - 8 * u, s.y - 8 * u, s.w + 16 * u, s.h + 16 * u, 12 * u); ctx.fill();
    const g = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
    g.addColorStop(0, '#04121e'); g.addColorStop(1, '#010509');
    ctx.fillStyle = g;
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h); ctx.clip();
    // snow on the camera, and the lines of an old monitor
    ctx.fillStyle = 'rgba(200, 220, 230, 0.25)';
    for (let i = 0; i < 40; i++) {
      const fx = ((i * 97.3 + this.t * 6 * (1 + (i % 3))) % s.w), fy = ((i * 53.1 + this.t * 10) % s.h);
      ctx.fillRect(s.x + fx, s.y + fy, 1.5 * u, 1.5 * u);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    for (let y = s.y; y < s.y + s.h; y += 3 * u) ctx.fillRect(s.x, y, s.w, 1);
    const cyc = (this.t % 2.6) / 2.6;
    const k = cyc < 0.7 ? 0.65 + 0.35 * Math.sin(cyc * 12) : 0.08;
    drawLureGlow(ctx, s.lx, s.ly, 34 * u, k);
    ctx.restore();
    ctx.font = this.font('800', 11);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(160, 230, 255, 0.85)';
    ctx.fillText(`CAM · 1500 m`, s.x + 8 * u, s.y + 16 * u);
    ctx.fillStyle = `rgba(255, 80, 80, ${0.5 + 0.5 * Math.sin(this.t * 4)})`;
    ctx.beginPath(); ctx.arc(s.x + s.w - 12 * u, s.y + 12 * u, 4 * u, 0, TAU); ctx.fill();
    if (this.spottedT > 0) {
      ctx.strokeStyle = `rgba(184, 246, 255, ${this.spottedT})`;
      ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.arc(s.lx, s.ly, (1.4 - this.spottedT) * 40 * u, 0, TAU); ctx.stroke();
    }
  }
}
