/**
 * Suri en de verloren satelliet - the space story, on the shared stage (`stage.ts`).
 *
 * The script is in `ruimtescript.ts`. What is particular to this story is here, and it is mostly
 * places that are not a field round you: the view out of the capsule's window while the child holds
 * the button and the rocket climbs (the sky going from morning blue to black by height, the clouds
 * coming down past the window, the curve of the Earth appearing), the Earth under you in orbit, the
 * long stretches between worlds, the ice of Saturn's rings coming at you while you steer, and the
 * glow of coming home. The Moon, Mars and the sea at the end are ordinary worlds round you, on the
 * same ground as the other stories, with a black sky or a butterscotch one.
 *
 * The Earth, the Moon, Mars and Saturn are photographs (`planetphoto.ts`), the same NASA frames the
 * solar-system journey uses, so the Saturn you fly towards is the one Cassini saw.
 */

import { NL, T } from '../util/lang';
import { isSpeaking } from '../platform/voice';
import { drawGuide } from '../platform/guide';
import { drawPhoto, loadMoon, loadPlanet, moonPhoto, planetPhoto } from '../platform/planetphoto';
import { blobPath, mix } from '../render/look';
import { altitudeAt, ASIDES, CHAPTERS, HEIGHT, SKY_NAMES, skyAt, type Chapter } from './ruimtescript';
import { TAU } from './look';
import { scatter, screenX, spot, type Palette, type View } from './world';
import { drawArm, drawBootprint, drawCrater, drawIce, drawISS, drawLander, drawParachutes, drawRocketOnPad, drawStip, drawStone, drawTube } from './spaceart';
import { bed, ruimteSfx, type Bed } from './ruimtesfx';
import { Stage, type Beast, type Pt } from './stage';

type Scene = 'pad' | 'launch' | 'orbit' | 'cruise' | 'moon' | 'mars' | 'rings' | 'reentry' | 'descent' | 'sea';
type Target = 'moon' | 'mars' | 'saturn' | 'earth';

interface Rock { kind: 'crater' | 'stone'; x: number; z: number; size: number; seed: number }
interface Chunk { x: number; y: number; z: number; size: number; seed: number; spin: number; vx: number; hit: boolean }
interface Star { a: number; e: number; r: number; tw: number }

const MORNING: Palette = {
  skyTop: '#5d9bd3', skyLow: '#f5d8b4', sun: '#fff1c8', sunAt: -0.9, sunUp: 0.12,
  cloud: '#fff6ea', clouds: 5, far: '#8fa8b4', mid: '#7a9870', ground: '#95a473', groundNear: '#6f7d4d', haze: '#eadcc6',
};

/** The Moon's grey, from the Apollo photographs: a little warm, never quite white. */
const MOON_GROUND = '#9d9a93';
const MARS_GROUND = '#c0744a';

export class Ruimte extends Stage {
  protected readonly id = 'satelliet';
  protected readonly chapters: Chapter[] = CHAPTERS;
  protected readonly title = { en: 'Suri and the lost satellite', nl: 'Suri en de verloren satelliet' };
  protected readonly lookAround = ASIDES.lookAround;

  private scene: Scene = 'pad';
  private stars: Star[] = [];
  private rocks: Rock[] = [];

  // the photo of Saturn Stip sent, on the screen at the launch pad
  private photoOn = false;
  private spottedT = 0;

  // the launch: how high, and how long the button has been held in all
  private alt = 0;
  private climb = 0;
  private separated = false;
  private lit = false;

  // holding the button between worlds: 0..1 of the way, and where to
  private boost = 0;
  private target: Target = 'moon';
  private idleT = 0;
  private nagged = false;

  // flying low over the Moon, then stopping
  private skim = 0;
  private skimTo = 0;

  // arriving somewhere by itself: landing on Mars, going home, the glow, the parachutes
  private auto: { t: number; dur: number; then: () => void } | null = null;
  private drop = 0;
  private chutesOpen = 0;

  // the robot arm on Mars
  private claw: Pt | null = null;
  private clawHome: Pt = { x: 0, y: 0 };
  private holding = false;
  private grabT = 0;

  // the rings: the ship's place in the lane, where the child is steering it, and the ice
  private ship = { x: 0, y: 0 };
  private aim = { x: 0, y: 0 };
  private steering: Pt | null = null;
  private tilt: { g: number; b: number } | null = null;
  private tilt0: { g: number; b: number } | null = null;
  private chunks: Chunk[] = [];
  private flyT = -1;
  private spawnT = 0;
  private bumps = 0;
  private stip: { x: number; y: number; z: number; dish: number; caughtT: number } | null = null;
  private alignT = 0;

  private flashT = 0;
  private playing: Bed | null = null;
  private engine = false;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    for (let i = 0; i < 260; i++) {
      this.stars.push({ a: Math.random() * TAU, e: Math.random() * 1.4 - 0.3, r: 0.4 + Math.random() * 1.3, tw: Math.random() * TAU });
    }
    for (const id of ['earth', 'mars', 'saturn']) void loadPlanet(id);
    void loadMoon('moon');
    window.addEventListener('deviceorientation', e => {
      if (e.gamma == null || e.beta == null) return;
      this.tilt = { g: e.gamma, b: e.beta };
    });
    this.run();
  }

  protected debugExtra(): Record<string, unknown> {
    return {
      scene: this.scene, alt: Math.round(this.alt), boost: Math.round(this.boost * 100) / 100,
      photo: this.photoOn, holding: this.holding, flyT: Math.round(this.flyT * 10) / 10, bumps: this.bumps,
      ship: { x: Math.round(this.ship.x * 10) / 10, y: Math.round(this.ship.y * 10) / 10 },
      stip: this.stip ? { x: Math.round(this.stip.x * 10) / 10, y: Math.round(this.stip.y * 10) / 10, z: Math.round(this.stip.z) } : null,
    };
  }

  // ---------------------------------------------------------------- where things are on screen

  /** The screen with Stip's last photo, and where Stip is on it. */
  photoRect(): { x: number; y: number; w: number; h: number; sx: number; sy: number } {
    const u = this.u();
    const pw = Math.min(this.w - 40 * u, 330 * u, this.h * 0.8), ph = pw * 0.56;
    const x = (this.w - pw) / 2, y = Math.min(80 * u, this.h * 0.16);
    return { x, y, w: pw, h: ph, sx: x + pw * 0.72, sy: y + ph * 0.6 };
  }

  private sideButton(): { x: number; y: number; w: number; h: number } {
    const u = this.u();
    const bw = 150 * u, bh = 62 * u;
    return { x: this.w - bw - 16 * u, y: this.h - 87 * u - bh - 18 * u, w: bw, h: bh };
  }

  /** Where the robot arm's shoulder is, and how long each of its two segments is. */
  private armBase(): { x: number; y: number; len: number } {
    const u = this.u();
    // long enough to reach anything in the middle of the view, whichever way the phone is held
    return { x: this.w * 0.5, y: this.h + 10 * u, len: Math.max(this.h * 0.28, this.w * 0.2) };
  }

  /** The claw at rest, and the tube on the ground: for the drivers and the tests. */
  clawAt(): Pt { return this.claw ?? this.restClaw(); }
  tubeAt(): Pt & { on: boolean } { const b = this.beastScreen(); return { x: b.sx, y: b.sy, on: b.on }; }

  private restClaw(): Pt {
    const a = this.armBase();
    return { x: a.x - a.len * 0.35, y: a.y - a.len * 1.05 };
  }

  protected view(): View {
    const v = super.view();
    // leaving a world the ground falls away under you; arriving, it comes up to meet you
    v.horizon += this.drop * this.h * 1.1;
    if (this.scene === 'sea') v.horizon += Math.sin(this.t * 0.8) * 8 * this.u();
    return v;
  }

  // ---------------------------------------------------------------- palettes

  protected palette(): Palette {
    if (this.scene === 'moon') {
      return {
        skyTop: '#000000', skyLow: '#04060a', sun: '#ffffff', sunAt: -1.3, sunUp: 0.3, cloud: '#000', clouds: 0,
        far: '#77756f', mid: '#8b8983', ground: MOON_GROUND, groundNear: '#7f7c75', haze: '#8b8983',
        space: true, sky: (ctx, v) => this.spaceSky(ctx, v, 'earth'),
      };
    }
    if (this.scene === 'mars') {
      // the Martian sky by day is butterscotch, from dust in the air; only round the sun is it bluish
      return {
        skyTop: '#b98a63', skyLow: '#e6c29a', sun: '#f5f1e6', sunAt: -0.7, sunUp: 0.45, cloud: '#e8c9a8', clouds: 0,
        far: '#9d5536', mid: '#b3623d', ground: MARS_GROUND, groundNear: '#98512f', haze: '#d9aa84',
      };
    }
    if (this.scene === 'sea') {
      return {
        skyTop: '#4d8fc9', skyLow: '#f4d2a8', sun: '#fff0c4', sunAt: 0.5, sunUp: 0.08, cloud: '#fff3e6', clouds: 6,
        far: '#2f6d93', mid: '#2f6d93', ground: '#2c6f96', groundNear: '#154867', haze: '#e6c9a8', bare: true,
      };
    }
    return MORNING;
  }

  protected gauge(): string {
    if (this.scene === 'launch') return `${Math.round(this.alt)} km · ${NL() ? SKY_NAMES[skyAt(this.alt)].nl : SKY_NAMES[skyAt(this.alt)].en}`;
    if (this.scene === 'orbit') return T('400 km above the Earth', '400 km boven de aarde');
    if (this.scene === 'moon') return T('384,000 km from the Earth', '384.000 km van de aarde');
    if (this.scene === 'mars') return T('228 million km from the Sun', '228 miljoen km van de zon');
    if (this.scene === 'rings') return T('1.4 billion km from the Sun', '1,4 miljard km van de zon');
    return '';
  }

  // ---------------------------------------------------------------- chapters and cues

  protected setup(c: Chapter): void {
    this.auto = null;
    this.idleT = 0; this.nagged = false;
    this.boost = 0;
    this.drop = 0;
    this.flashT = 0;
    this.steering = null;
    if (c.id === 'pad') {
      this.scene = 'pad'; this.photoOn = false; this.spottedT = 0;
      this.alt = 0; this.climb = 0; this.separated = false; this.lit = false;
      this.holding = false; this.claw = null; this.stip = null; this.chunks = []; this.flyT = -1; this.bumps = 0;
      this.chutesOpen = 0;
      this.props = scatter(12, [['tuft', 40, 1], ['rock', 12, 0.8], ['palm', 10, 1.4]], 0.45, 10);
      this.beast = null; this.life = null;
    } else if (c.id === 'orbit') {
      this.scene = 'orbit'; this.props = []; this.target = 'moon';
      // the station, going round slowly, higher than you and a long way off
      this.beast = { kind: 'iss', x: 0, z: 0, speed: 0, heading: 0, orbit: { r: 40, a: Math.PI * 0.75, w: 0.05 }, phase: 0, stride: 1, head: 0, jaw: 0, lift: 9 };
    } else if (c.id === 'moon') {
      this.scene = 'moon'; this.props = []; this.beast = null; this.target = 'mars';
      this.buildRocks(31, 'moon');
      this.skim = 14; this.skimTo = 14;
    } else if (c.id === 'mars') {
      this.scene = 'mars'; this.props = []; this.beast = null; this.target = 'saturn';
      this.holding = false; this.claw = null; this.grabT = 0;
      this.buildRocks(57, 'mars');
      this.drop = 1;
    } else if (c.id === 'rings') {
      this.scene = 'rings'; this.props = []; this.beast = null; this.rocks = [];
      this.ship = { x: 0, y: 0 }; this.aim = { x: 0, y: 0 };
      this.chunks = []; this.flyT = -1; this.stip = null; this.alignT = 0; this.bumps = 0;
      // a few chunks already drifting ahead, so the rings are there before the flying starts
      for (let i = 0; i < 14; i++) this.chunks.push(this.newChunk(20 + i * 5));
    } else if (c.id === 'home') {
      this.scene = 'cruise'; this.beast = null; this.target = 'earth'; this.boost = 0;
    }
  }

  protected cue(name: string): void {
    const u = this.u();
    if (name === 'photo') { this.photoOn = true; ruimteSfx.radio(); }
    else if (name === 'board') {
      this.photoOn = false;
      ruimteSfx.hatch();
      this.scene = 'launch';
      this.props = [];
      this.alt = 0; this.climb = 0;
    } else if (name === 'hover') { this.skimTo = 0; ruimteSfx.thrusters(); this.placeLander(); }
    else if (name === 'land') {
      ruimteSfx.thrusters();
      this.drop = 1;
      this.auto = { t: 0, dur: 4.5, then: () => {
        this.drop = 0;
        this.ps.spawn('dust', this.w / 2, this.h * 0.8, 40, { colour: 'rgba(214, 150, 100, 0.8)', speed: 220, size: 9 * u, max: 1.6, spread: TAU, grav: 30 });
        this.shake = 0.5;
        this.placeTube();
        this.flags.add('landed');
      } };
    } else if (name === 'fly') { this.flyT = 0; this.tilt0 = this.tilt ? { ...this.tilt } : null; }
    else if (name === 'homeward') {
      this.scene = 'cruise'; this.target = 'earth'; this.boost = 0;
      this.auto = { t: 0, dur: 7, then: () => { this.boost = 1; } };
    } else if (name === 'reentry') {
      this.scene = 'reentry'; this.boost = 0;
      this.auto = { t: 0, dur: 7, then: () => this.flags.add('slowed') };
    } else if (name === 'end') { ruimteSfx.done(); this.finished = true; this.markSeen(); }
  }

  protected ambience(): void {
    if (!this.started) return;
    const want: Bed = this.scene === 'pad' ? 'pad' : this.scene === 'mars' ? 'mars' : this.scene === 'sea' ? 'sea' : 'cabin';
    const engine = (this.held === 'go' && (this.waiting() === 'launched' || this.waiting() === 'boosted'))
      || this.scene === 'reentry' || (this.scene === 'mars' && !!this.auto);
    if (want === this.playing && engine === this.engine) return;
    this.playing = want; this.engine = engine;
    bed(want, engine);
  }

  destroy(): void { super.destroy(); bed(null); }

  protected onFound(b: Beast): void {
    if (b.kind === 'iss') ruimteSfx.radio();
  }

  // ---------------------------------------------------------------- the places

  /** Craters and stones all round you, the same every time: grey on the Moon, rusty on Mars. */
  private buildRocks(seed: number, where: 'moon' | 'mars'): void {
    let a = seed;
    const r = (): number => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    this.rocks = [];
    for (let i = 0; i < 90; i++) {
      const x = (r() - 0.5) * 60, z = (r() - 0.5) * 60;
      if (Math.hypot(x, z) < 2.2) continue;
      const crater = where === 'moon' ? r() < 0.55 : r() < 0.18;
      this.rocks.push({ kind: crater ? 'crater' : 'stone', x, z, size: crater ? 0.8 + r() * 3.5 : 0.08 + r() * (where === 'mars' ? 0.35 : 0.25), seed: i });
    }
  }

  private placeLander(): void {
    // behind you and to the right, a stone's throw away, in a patch without craters
    const a = 2.3, d = 9;
    this.beast = { kind: 'lander', x: Math.sin(a) * d, z: Math.cos(a) * d, speed: 0, heading: 0, phase: 0, stride: 1, head: 0, jaw: 0, lift: 0 };
    this.rocks = this.rocks.filter(k => Math.hypot(k.x - this.beast!.x, k.z - this.beast!.z) > 5);
  }

  private placeTube(): void {
    // a few steps away, to the left behind you: small, so it has to be looked for
    const a = -2.0, d = 5.5;
    this.beast = { kind: 'tube', x: Math.sin(a) * d, z: Math.cos(a) * d, speed: 0, heading: 0, phase: 0, stride: 1, head: 0, jaw: 0, lift: 0 };
    this.rocks = this.rocks.filter(k => Math.hypot(k.x - this.beast!.x, k.z - this.beast!.z) > 1.5);
  }

  private newChunk(z = 90): Chunk {
    // most of the ice is small, a few pieces are big; they come from anywhere in the lane, but
    // lean towards where the ship is, so steering matters
    const big = Math.random() < 0.18;
    return {
      x: this.ship.x + (Math.random() - 0.5) * 11, y: this.ship.y + (Math.random() - 0.5) * 6.5, z,
      size: big ? 1.4 + Math.random() * 1.2 : 0.25 + Math.random() * 0.7,
      seed: Math.floor(Math.random() * 1000), spin: Math.random() * TAU, vx: 0, hit: false,
    };
  }

  // ---------------------------------------------------------------- per frame

  protected tick(dt: number): void {
    const u = this.u();
    this.flashT = Math.max(0, this.flashT - dt * 0.8);
    if (this.spottedT > 0) this.spottedT -= dt;
    const w = this.waiting();

    if (this.auto) {
      const a = this.auto;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      if (this.scene === 'mars') { const e = 1 - Math.pow(1 - k, 3); this.drop = 1 - e; }
      if (this.scene === 'cruise') this.boost = k;
      if (this.scene === 'descent') this.chutesOpen = Math.min(1, a.t / 1.4);
      if (k >= 1) { this.auto = null; a.then(); }
    }

    // holding the button on the pad: the rocket climbs, slowly at first and then ever faster
    if (w === 'launched') {
      if (this.held === 'go') {
        if (!this.lit) { this.lit = true; ruimteSfx.ignite(); this.shake = 0.8; }
        this.climb = Math.min(1, this.climb + dt / 12);
        this.alt = altitudeAt(this.climb);
        this.shake = Math.max(this.shake, 0.25 * (1 - this.climb) + 0.08);
        this.idleT = 0;
        if (!this.separated && this.alt >= HEIGHT.booster) { this.separated = true; ruimteSfx.separate(); this.shake = 0.7; this.flashT = 0.6; }
        if (this.climb >= 1) { this.flags.add('launched'); ruimteSfx.radio(); }
      } else this.nag(dt, this.climb > 0.02);
    }

    // holding the button between worlds: the place you are falls away, then the next one grows
    if (w === 'boosted') {
      if (this.held === 'go') {
        if (this.boost === 0) ruimteSfx.boost();
        this.boost = Math.min(1, this.boost + dt / 6);
        this.idleT = 0;
        if (this.scene !== 'cruise') {
          this.drop = Math.min(1, this.boost / 0.3);
          if (this.boost >= 0.3) { this.scene = 'cruise'; this.drop = 0; this.beast = null; }
        }
        if (this.boost >= 1) this.flags.add('boosted');
      } else this.nag(dt, this.boost > 0.02);
    }

    // over the Moon: the ground streams past, and slows to a stop when Suri says so
    if (this.scene === 'moon') {
      this.skim += (this.skimTo - this.skim) * Math.min(1, dt * 0.9);
      if (this.skim > 0.05) for (const r of this.rocks) { r.z -= this.skim * dt; if (r.z < -30) r.z += 60; }
    }

    if (this.scene === 'rings') this.fly(dt);

    // the claw lets go of nothing, closes on the tube, and swings back in with it
    if (this.holding) {
      this.grabT += dt;
      const home = this.restClaw();
      const k = Math.min(1, this.grabT / 1.2);
      if (this.claw) { this.claw.x += (home.x - this.claw.x) * k * 0.2; this.claw.y += (home.y - this.claw.y) * k * 0.2; }
    }

    // the parachutes, and then the sea coming up to meet you
    if (w === 'splashed' && this.scene === 'descent' && !this.auto) {
      this.drop = Math.max(0, this.drop - dt / 6);
      if (this.drop <= 0) {
        ruimteSfx.splash();
        this.flashT = 1; this.shake = 0.6;
        this.scene = 'sea';
        this.flags.add('splashed');
        this.ps.spawn('splash', this.w / 2, this.h * 0.75, 40, { colour: 'rgba(230, 245, 255, 0.9)', speed: 260, size: 8 * u, max: 1.4, spread: Math.PI, grav: 400 });
      }
    }

    if (this.beast?.orbit) {
      const b = this.beast;
      b.orbit!.a += b.orbit!.w * dt;
      b.x = Math.sin(b.orbit!.a) * b.orbit!.r;
      b.z = Math.cos(b.orbit!.a) * b.orbit!.r;
    }
    this.ambience();
  }

  /** Not holding the button any more, after starting: a gentle reminder, once. */
  private nag(dt: number, started: boolean): void {
    this.idleT += dt;
    if (started && this.idleT > 3 && !this.nagged) { this.nagged = true; this.aside(ASIDES.holdOn); }
  }

  /** Through the rings: steer, dodge or bump the ice, and at the end, find Stip. */
  private fly(dt: number): void {
    const u = this.u();
    // steering: a finger on the screen wins; otherwise the tilt of the phone; otherwise straight on
    if (this.steering) {
      this.aim.x = ((this.steering.x - this.w / 2) / (this.w / 2)) * 5;
      this.aim.y = ((this.steering.y - this.h * 0.5) / (this.h / 2)) * 3;
    } else if (this.tilt && this.tilt0 && this.flyT >= 0) {
      this.aim.x = ((this.tilt.g - this.tilt0.g) / 25) * 5;
      this.aim.y = ((this.tilt.b - this.tilt0.b) / 20) * 3;
    }
    this.aim.x = Math.max(-5, Math.min(5, this.aim.x));
    this.aim.y = Math.max(-3, Math.min(3, this.aim.y));
    this.ship.x += (this.aim.x - this.ship.x) * Math.min(1, dt * 3);
    this.ship.y += (this.aim.y - this.ship.y) * Math.min(1, dt * 3);

    const flying = this.flyT >= 0;
    const speed = flying ? (this.stip ? 10 : 16) : 3;
    if (flying) {
      this.flyT += dt;
      this.spawnT -= dt;
      if (this.spawnT <= 0 && (!this.stip || this.stip.caughtT < 0)) { this.chunks.push(this.newChunk()); this.spawnT = this.stip ? 0.7 : 0.2; }
      if (this.flyT > 15 && !this.flags.has('through')) {
        this.flags.add('through');
        const side = Math.random() < 0.5 ? -1 : 1;
        this.stip = { x: side * 2.6, y: (Math.random() - 0.5) * 2, z: 80, dish: Math.PI * 0.8, caughtT: -1 };
      }
    }
    for (const c of this.chunks) {
      c.z -= speed * dt;
      c.x += c.vx * dt;
      c.spin += dt * 0.3 * (c.seed % 2 ? 1 : -1);
      // a bump: the ice nudges the capsule and goes spinning off; nothing breaks, nothing is lost
      if (!c.hit && c.z < 2 && c.z > 0.4 && Math.abs(c.x - this.ship.x) < c.size * 0.7 + 0.5 && Math.abs(c.y - this.ship.y) < c.size * 0.6 + 0.4) {
        c.hit = true;
        c.vx = (c.x >= this.ship.x ? 1 : -1) * 6;
        this.shake = 0.6; this.bumps++;
        ruimteSfx.bump();
        this.ps.spawn('spark', this.w / 2, this.h / 2, 12, { colour: '#e8f4ff', speed: 200, size: 4 * u, max: 0.6, spread: TAU });
        if (this.bumps === 1 && !isSpeaking()) this.aside(ASIDES.bump);
      }
    }
    this.chunks = this.chunks.filter(c => c.z > 0.3);

    const s = this.stip;
    if (s) {
      if (s.caughtT < 0) {
        s.z = Math.max(8, s.z - speed * dt);
        s.y += Math.sin(this.t * 0.7) * dt * 0.2;
        const lined = s.z <= 9 && Math.abs(s.x - this.ship.x) < 1.4 && Math.abs(s.y - this.ship.y) < 1.1;
        this.alignT = lined ? this.alignT + dt : 0;
        if (this.alignT > 0.3) {
          s.caughtT = 0;
          ruimteSfx.caught();
          this.flags.add('caught');
          this.ps.spawn('spark', this.w / 2, this.h / 2, 18, { colour: '#ffd98a', speed: 160, size: 5 * u, max: 1, spread: TAU });
        }
      } else {
        // caught: he comes in close in front of the window, and his dish turns back towards home
        s.caughtT += dt;
        s.z += (5 - s.z) * Math.min(1, dt * 1.5);
        s.x += (this.ship.x - s.x) * Math.min(1, dt * 2);
        s.y += (this.ship.y - s.y) * Math.min(1, dt * 2);
        s.dish = Math.max(0, s.dish - dt * 0.8);
      }
    }
  }

  // ---------------------------------------------------------------- the child's hands

  protected down(p: Pt): boolean {
    const w = this.waiting();
    const u = this.u();
    if (this.photoOn && w === 'spotted') {
      const r = this.photoRect();
      if (p.x > r.x - 10 * u && p.x < r.x + r.w + 10 * u && p.y > r.y - 10 * u && p.y < r.y + r.h + 10 * u) {
        this.flags.add('spotted');
        this.spottedT = 1;
        ruimteSfx.spotted();
        this.ps.spawn('spark', r.sx, r.sy, 14, { colour: '#ffd0c8', speed: 110, size: 5 * u, max: 0.8, spread: TAU });
        return true;
      }
    }
    if (w === 'grabbed' && !this.holding) {
      const c = this.clawAt();
      if (Math.hypot(p.x - c.x, p.y - c.y) < 70 * u) { this.claw = { x: p.x, y: p.y }; ruimteSfx.whir(); return true; }
    }
    if (this.scene === 'rings') { this.steering = p; return true; }
    return false;
  }

  protected drag(p: Pt): boolean {
    if (this.claw && !this.holding && this.held === null) {
      const a = this.armBase();
      // the arm only reaches so far: the claw stops at the end of it
      const dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy), max = a.len * 1.95;
      this.claw = d > max ? { x: a.x + (dx / d) * max, y: a.y + (dy / d) * max } : { x: p.x, y: p.y };
      this.tryGrab();
      return true;
    }
    if (this.steering) { this.steering = p; return true; }
    return false;
  }

  protected release(): void {
    this.steering = null;
    if (this.claw && !this.holding) { this.tryGrab(); if (!this.holding) this.claw = null; }
  }

  private tryGrab(): void {
    if (!this.claw || this.holding || this.waiting() !== 'grabbed') return;
    const tb = this.tubeAt();
    if (tb.on && Math.hypot(this.claw.x - tb.x, this.claw.y - tb.y) < 42 * this.u()) {
      this.holding = true;
      this.grabT = 0;
      this.beast = null;
      ruimteSfx.grab();
      this.flags.add('grabbed');
    }
  }

  protected press(id: string): void {
    if (id === 'chute') {
      ruimteSfx.chutes();
      this.flags.add('chutes');
      this.scene = 'descent';
      this.drop = 1;
      this.chutesOpen = 0;
      this.shake = 0.5;
      this.auto = { t: 0, dur: 1.6, then: () => { /* the canopies are open; the sea comes up in tick */ } };
      return;
    }
    super.press(id);
  }

  // ---------------------------------------------------------------- drawing: the places that are not a field

  protected drawScene(): boolean {
    if (this.scene === 'launch') { this.drawLaunch(); this.drawWindow(); return true; }
    if (this.scene === 'orbit') { this.drawOrbit(); this.drawWindow(); return true; }
    if (this.scene === 'cruise') { this.drawCruise(); this.drawWindow(); return true; }
    if (this.scene === 'rings') { this.drawRings(); this.drawWindow(); return true; }
    if (this.scene === 'reentry') { this.drawReentry(); this.drawWindow(); return true; }
    if (this.scene === 'descent') { this.drawDescent(); this.drawWindow(); return true; }
    return false;
  }

  /** Stars fixed in the sky, so they slide past as you turn; fainter where there is still some air. */
  private drawStars(v: View | null, alpha: number, stretch = 0): void {
    if (alpha <= 0.01) return;
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = '#ffffff';
    for (const s of this.stars) {
      let x: number, y: number;
      if (v) {
        x = screenX(v, s.a);
        if (x < -4 || x > this.w + 4) continue;
        y = v.horizon - s.e * v.f;
        if (y < -4 || y > this.h) continue;
      } else {
        // no turning: the stars as a flat field, for the long flights between worlds
        x = ((s.a / TAU) * this.w * 1.3) % this.w;
        y = ((s.e + 0.3) / 1.4) * this.h;
      }
      ctx.globalAlpha = alpha * (0.45 + 0.4 * Math.sin(this.t * 1.7 + s.tw));
      if (stretch > 0) {
        // flying fast: every star streaks away from the middle
        const dx = x - this.w / 2, dy = y - this.h / 2;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s.r * u;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * stretch * 0.25, y + dy * stretch * 0.25); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(x, y, s.r * u, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The black sky of the Moon: stars, a hard white sun, and the Earth hanging above the hills. */
  private spaceSky(ctx: CanvasRenderingContext2D, v: View, body: 'earth'): void {
    this.drawStars(v, 0.9);
    const sx = screenX(v, -1.3), sy = v.horizon - 0.3 * v.f;
    if (sx > -60 && sx < this.w + 60) {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, v.f * 0.08);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.2, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, v.f * 0.08, 0, TAU); ctx.fill();
    }
    const ex = screenX(v, 0.55), ey = v.horizon - 0.32 * v.f, er = v.f * 0.045;
    if (ex > -er && ex < this.w + er) {
      const photo = planetPhoto(body);
      if (photo) drawPhoto(ctx, photo, ex, ey, er);
      else { ctx.fillStyle = '#3d7fc4'; ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill(); }
    }
  }

  /** The launch, through the window: the ground falling away, the clouds, the sky turning black. */
  private drawLaunch(): void {
    const ctx = this.ctx, u = this.u();
    const a = this.alt;
    const k = Math.min(1, a / HEIGHT.black);
    const top = mix(MORNING.skyTop, '#010208', Math.pow(k, 0.6));
    const low = mix(MORNING.skyLow, '#0a1a36', Math.pow(k, 0.8));
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, top); g.addColorStop(1, low);
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    this.drawStars(null, Math.max(0, Math.min(1, (a - 45) / 55)));

    // the curve of the Earth, appearing below once you are high enough to see it
    if (a > 50) {
      const rise = Math.min(1, (a - 50) / 300);
      this.drawEarthBelow(this.h * (1.05 - rise * 0.3), rise);
    }

    // the ground and the tower, sliding down out of the window in the first seconds
    const gy = this.h * 0.68 + a * this.h * 1.6;
    if (gy < this.h + 10) {
      const gg = ctx.createLinearGradient(0, gy, 0, this.h);
      gg.addColorStop(0, MORNING.ground); gg.addColorStop(1, MORNING.groundNear);
      ctx.fillStyle = gg; ctx.fillRect(0, gy, this.w, this.h - gy + 10);
      ctx.fillStyle = MORNING.far; ctx.fillRect(0, gy - 6 * u, this.w, 6 * u);
    }
    const ty = this.h * 0.1 + a * this.h * 7;
    if (ty < this.h) {
      ctx.strokeStyle = '#a8412f'; ctx.lineWidth = 4 * u;
      const tx = this.w * 0.82;
      ctx.strokeRect(tx, ty - this.h, 40 * u, this.h * 2);
      ctx.beginPath();
      for (let i = 0; i < 20; i++) { const yy = ty - this.h + i * this.h * 0.1; ctx.moveTo(tx, yy); ctx.lineTo(tx + 40 * u, yy + this.h * 0.1); }
      ctx.stroke();
    }

    // three layers of cloud; each comes down from the top, fills the window white, and is gone
    const layers = [2, 5.5, 9.5];
    for (let li = 0; li < layers.length; li++) {
      const d = layers[li] - a;
      const y = this.h * 0.5 - d * this.h * 0.45;
      if (y > -this.h * 0.4 && y < this.h * 1.4) this.cloudBand(y, li);
      const inside = Math.max(0, 1 - Math.abs(d) / 0.7);
      if (inside > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${inside * 0.75})`; ctx.fillRect(0, 0, this.w, this.h); }
    }

    // the glow of the engines, down at the bottom edge, while they burn
    if (this.held === 'go' && this.waiting() === 'launched') {
      const fg = ctx.createLinearGradient(0, this.h * 0.75, 0, this.h);
      fg.addColorStop(0, 'rgba(255, 170, 60, 0)'); fg.addColorStop(1, `rgba(255, 150, 50, ${0.35 + 0.1 * Math.sin(this.t * 30)})`);
      ctx.fillStyle = fg; ctx.fillRect(0, this.h * 0.75, this.w, this.h * 0.25);
    }
    if (this.flashT > 0) { ctx.fillStyle = `rgba(255, 240, 220, ${this.flashT * 0.4})`; ctx.fillRect(0, 0, this.w, this.h); }
  }

  /** One layer of cloud, as a band of puffs across the window. */
  private cloudBand(y: number, seed: number): void {
    const ctx = this.ctx;
    const r = this.h * 0.14;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    for (let i = -1; i < 9; i++) {
      const x = (i / 8) * this.w + Math.sin(i * 3.1 + seed) * r * 0.5;
      const yy = y + Math.sin(i * 1.9 + seed * 2) * r * 0.35;
      ctx.beginPath();
      ctx.ellipse(x, yy, r * 1.3, r * 0.55, 0, 0, TAU);
      ctx.ellipse(x - r * 0.5, yy - r * 0.3, r * 0.7, r * 0.5, 0, 0, TAU);
      ctx.ellipse(x + r * 0.5, yy - r * 0.35, r * 0.8, r * 0.55, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(210, 222, 235, 0.6)';
    for (let i = -1; i < 9; i++) {
      const x = (i / 8) * this.w + Math.sin(i * 3.1 + seed) * r * 0.5;
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.35, r * 1.2, r * 0.25, 0, 0, TAU); ctx.fill();
    }
  }

  /**
   * The Earth under you: a curve of blue sea and white cloud, with the thin glowing skin of air
   * along its edge. `top` is where the edge is at its highest, `k` how far round you can see.
   */
  private drawEarthBelow(top: number, k: number, yaw = 0): void {
    const ctx = this.ctx, u = this.u();
    const R = this.w * (3.2 - k * 1.4);
    const cx = this.w / 2, cy = top + R;
    ctx.save();
    // the air glowing blue along the edge
    const glow = ctx.createRadialGradient(cx, cy, R * 0.985, cx, cy, R * 1.03);
    glow.addColorStop(0, 'rgba(120, 190, 255, 0.9)'); glow.addColorStop(0.4, 'rgba(90, 160, 255, 0.35)'); glow.addColorStop(1, 'rgba(60, 120, 255, 0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, R * 1.03, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip();
    const sea = ctx.createLinearGradient(0, top, 0, this.h);
    sea.addColorStop(0, '#5b8fc9'); sea.addColorStop(0.15, '#1e5a9a'); sea.addColorStop(1, '#0d3a6e');
    ctx.fillStyle = sea; ctx.fillRect(0, top - 2, this.w, this.h - top + 4);
    // land and cloud, lying flat on the curve: squashed thin near the edge, rounder below you.
    // Each is a lumpy shape from a seed, so no two are alike and none is an ellipse.
    const drift = this.t * 0.012 + yaw;
    const lay = (i: number, depth: number, size: number, colour: string, wob: number): void => {
      const x = ((((i * 0.137 + drift * (0.6 + depth)) % 1) + 1) % 1) * this.w * 1.6 - this.w * 0.3;
      const y = top + depth * (this.h - top) * 1.1;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.5, 0.12 + depth * 0.7);
      ctx.fillStyle = colour;
      blobPath(ctx, 0, 0, size * (0.4 + depth * 1.6), i * 7 + 3, wob, 13);
      ctx.fill();
      ctx.restore();
    };
    // seven parts in ten of the Earth is sea, so the land is a few patches and most is blue
    for (let i = 0; i < 6; i++) {
      const depth = 0.05 + ((i * 0.37) % 1) ** 2;
      lay(i + 100, depth, (34 + (i * 53) % 50) * u, i % 2 ? 'rgba(112, 128, 74, 0.9)' : 'rgba(170, 146, 96, 0.9)', 0.5);
    }
    for (let i = 0; i < 110; i++) {
      const depth = 0.03 + ((i * 0.618) % 1) ** 2;
      lay(i, depth, (8 + (i * 37) % 30) * u, `rgba(255, 255, 255, ${0.3 + (i % 4) * 0.12})`, 0.4);
    }
    // the edge a little brighter, where you look through the most air
    ctx.strokeStyle = 'rgba(190, 225, 255, 0.7)'; ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.arc(cx, cy, R - 1.5 * u, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  /** In orbit: the Earth below, the stars and the sun above, and the station somewhere round you. */
  private drawOrbit(): void {
    const ctx = this.ctx, u = this.u();
    const v = this.view();
    ctx.fillStyle = '#010206'; ctx.fillRect(0, 0, this.w, this.h);
    this.drawStars(v, 1);
    const sx = screenX(v, 1.1), sy = v.horizon - 0.35 * v.f;
    if (sx > -80 && sx < this.w + 80) {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60 * u);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.25, 'rgba(255,255,250,0.85)'); g.addColorStop(1, 'rgba(255,255,250,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 60 * u, 0, TAU); ctx.fill();
    }
    const top = v.horizon + this.h * 0.08;
    this.drawEarthBelow(top, 0.6, -v.yaw / TAU);
    const b = this.beast;
    if (b) this.drawBeast(v, b);
  }

  /** Between worlds: the stars streaking past, and the next world growing in the middle. */
  private drawCruise(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = '#010206'; ctx.fillRect(0, 0, this.w, this.h);
    const k = this.boost;
    this.drawStars(null, 1, Math.sin(Math.min(1, k) * Math.PI) * 0.8);
    const grow = Math.max(0, (k - 0.3) / 0.7);
    const big = this.target === 'saturn' ? this.h * 0.2 : this.h * 0.3;
    const r = 3 * u + Math.pow(grow, 2.5) * big;
    const photo = this.target === 'moon' ? moonPhoto('moon') : planetPhoto(this.target);
    const cx = this.w / 2, cy = this.h * 0.45;
    if (photo) drawPhoto(ctx, photo, cx, cy, r);
    else {
      const colour = this.target === 'mars' ? '#c1693c' : this.target === 'saturn' ? '#d9c08a' : this.target === 'earth' ? '#3d7fc4' : '#a9a7a0';
      ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    }
  }

  /** The rings of Saturn: the planet huge beyond them, and the ice coming at the window. */
  private drawRings(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = '#010206'; ctx.fillRect(0, 0, this.w, this.h);
    this.drawStars(null, 0.8);
    const F = Math.max(this.w, this.h) * 0.55;
    const hx = this.w / 2 - this.ship.x * F * 0.02, hy = this.h * 0.5 - this.ship.y * F * 0.02;
    this.drawSaturn(hx + this.w * 0.14, hy - this.h * 0.02, Math.min(this.w, this.h) * 0.42, hy);
    // the ring plane you are flying in: a glittering band from one side of the sky to the other
    const band = ctx.createLinearGradient(0, hy - this.h * 0.08, 0, hy + this.h * 0.08);
    band.addColorStop(0, 'rgba(220, 200, 170, 0)'); band.addColorStop(0.5, 'rgba(225, 208, 180, 0.35)'); band.addColorStop(1, 'rgba(220, 200, 170, 0)');
    ctx.fillStyle = band; ctx.fillRect(0, hy - this.h * 0.08, this.w, this.h * 0.16);
    // grains of ice streaming past: tiny near the middle, coming out towards the edges, faster
    // when the capsule is flying
    const pace = this.flyT >= 0 ? 1 : 0.2;
    ctx.fillStyle = 'rgba(240, 232, 215, 0.8)';
    for (let i = 0; i < 140; i++) {
      const a = (i * 2.399) % TAU;
      const k = ((this.t * 0.35 * pace * (0.6 + (i % 5) * 0.2) + i * 0.137) % 1);
      const d = Math.pow(k, 2.2) * Math.max(this.w, this.h) * 0.8;
      const x = hx + Math.cos(a) * d * 1.3, y = hy + Math.sin(a) * d * 0.45;
      const r = (0.5 + k * 2.2) * u;
      ctx.globalAlpha = Math.min(1, k * 3);
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
    // the ice, far to near
    const items: Array<{ z: number; draw: () => void }> = [];
    for (const c of this.chunks) {
      items.push({ z: c.z, draw: () => {
        const x = hx + ((c.x - this.ship.x) * F) / c.z, y = hy + ((c.y - this.ship.y) * F) / c.z, r = (c.size * F) / c.z;
        if (x < -r || x > this.w + r || y < -r || y > this.h + r) return;
        // far off they fade in; the last metre they fade out, as they slide past the window
        ctx.globalAlpha = Math.min(1, (90 - c.z) / 25, (c.z - 0.3) / 1.2);
        drawIce(ctx, x, y, r, c.seed, c.spin);
        ctx.globalAlpha = 1;
      } });
    }
    const s = this.stip;
    if (s) {
      items.push({ z: s.z, draw: () => {
        const x = hx + ((s.x - this.ship.x) * F) / s.z, y = hy + ((s.y - this.ship.y) * F) / s.z, r = (1.1 * F) / s.z;
        ctx.globalAlpha = Math.min(1, (90 - s.z) / 20);
        drawStip(ctx, x, y, Math.max(6 * u, r), this.t, s.dish, s.caughtT >= 0 ? 0 : Math.sin(this.t * 0.6) * 0.5);
        ctx.globalAlpha = 1;
        // a ring round him until he is caught, so a small child can see where to steer
        if (s.caughtT < 0) {
          ctx.strokeStyle = `rgba(255, 200, 120, ${0.4 + 0.3 * Math.sin(this.t * 5)})`;
          ctx.lineWidth = 3 * u;
          ctx.beginPath(); ctx.arc(x, y, Math.max(22 * u, r * 1.6), 0, TAU); ctx.stroke();
        }
      } });
    }
    items.sort((a, b) => b.z - a.z).forEach(i => i.draw());
    // the sight in the middle of the window: where the capsule is going
    if (this.flyT >= 0 && !(s && s.caughtT >= 0)) {
      ctx.strokeStyle = 'rgba(160, 230, 255, 0.55)'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(this.w / 2, this.h / 2, 16 * u, 0, TAU);
      ctx.moveTo(this.w / 2 - 28 * u, this.h / 2); ctx.lineTo(this.w / 2 - 20 * u, this.h / 2);
      ctx.moveTo(this.w / 2 + 20 * u, this.h / 2); ctx.lineTo(this.w / 2 + 28 * u, this.h / 2);
      ctx.stroke();
    }
  }

  /**
   * Saturn from inside the ring plane: a banded ball, and the rings seen exactly edge-on as one thin
   * bright line across it, with their shadow on the planet. That is what the rings look like from
   * where you are flying; the familiar wide rings are the view from above or below them.
   */
  private drawSaturn(cx: number, cy: number, r: number, ringY: number): void {
    const ctx = this.ctx, u = this.u();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    const bands = ['#e9d6a6', '#d8bd84', '#e3cc98', '#c9a66c', '#dcc190', '#bf9a60', '#d6b884', '#e6d2a2', '#c8a56e', '#d9bf8a'];
    // the bands as one soft gradient from pole to pole, so there are no seams between them
    const bg = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    bands.forEach((c, i) => bg.addColorStop(i / (bands.length - 1), c));
    ctx.fillStyle = bg;
    ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    // the night side, and the shadow the rings throw on the planet
    const sh = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(0.6, 'rgba(0,0,0,0.05)'); sh.addColorStop(1, 'rgba(0,0,10,0.75)');
    ctx.fillStyle = sh; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.fillStyle = 'rgba(30, 20, 10, 0.35)';
    ctx.fillRect(cx - r, ringY + r * 0.05, 2 * r, r * 0.12);
    const limb = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.6, cx, cy, r);
    limb.addColorStop(0, 'rgba(0,0,0,0)'); limb.addColorStop(1, 'rgba(40, 25, 5, 0.45)');
    ctx.fillStyle = limb; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    ctx.restore();
    // the rings, edge on: a thin bright line far wider than the planet
    const g = ctx.createLinearGradient(0, 0, this.w, 0);
    g.addColorStop(0, 'rgba(235, 220, 190, 0.1)'); g.addColorStop(0.5, 'rgba(245, 235, 210, 0.95)'); g.addColorStop(1, 'rgba(235, 220, 190, 0.1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, ringY - 1.2 * u, this.w, 2.4 * u);
  }

  /** Coming home: the air outside glows orange and streams past the window. */
  private drawReentry(): void {
    const ctx = this.ctx, u = this.u();
    const k = this.auto ? Math.min(1, this.auto.t / this.auto.dur) : 1;
    const heat = Math.sin(Math.min(1, k * 1.15) * Math.PI);
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, mix('#020612', '#3d78c0', k)); sky.addColorStop(1, mix('#0a1a36', '#9cc6ea', k));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, this.w, this.h);
    const g = ctx.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.15, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.7);
    g.addColorStop(0, 'rgba(255, 140, 40, 0)'); g.addColorStop(0.6, `rgba(255, 120, 30, ${0.45 * heat})`); g.addColorStop(1, `rgba(255, 210, 120, ${0.9 * heat})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * TAU + Math.sin(i * 7.7) * 0.2;
      const p = (this.t * (1.2 + (i % 5) * 0.3) + i * 0.137) % 1;
      const r0 = Math.max(this.w, this.h) * (0.25 + p * 0.5);
      const x = this.w / 2 + Math.cos(a) * r0, y = this.h / 2 + Math.sin(a) * r0;
      ctx.strokeStyle = `rgba(255, ${150 + (i % 3) * 30}, 60, ${0.5 * heat * (1 - p)})`;
      ctx.lineWidth = (2 + (i % 3)) * u;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 60 * u, y + Math.sin(a) * 60 * u); ctx.stroke();
    }
    ctx.restore();
    if (heat > 0.3) this.shake = Math.max(this.shake, 0.15 * heat);
  }

  /** Under the parachutes: morning sky, the canopies above, and the sea coming up from below. */
  private drawDescent(): void {
    const ctx = this.ctx, u = this.u();
    const sky = ctx.createLinearGradient(0, 0, 0, this.h);
    sky.addColorStop(0, '#4d8fc9'); sky.addColorStop(1, '#f4d2a8');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, this.w, this.h);
    const hz = this.h * 0.62 + this.drop * this.h * 0.55;
    if (hz < this.h) {
      const sea = ctx.createLinearGradient(0, hz, 0, this.h);
      sea.addColorStop(0, '#2f6d93'); sea.addColorStop(1, '#154867');
      ctx.fillStyle = sea; ctx.fillRect(0, hz, this.w, this.h - hz);
      ctx.strokeStyle = 'rgba(255, 235, 200, 0.25)'; ctx.lineWidth = 1.5 * u;
      for (let i = 0; i < 12; i++) {
        const y = hz + (this.h - hz) * Math.pow(i / 12, 1.6) + 3;
        ctx.beginPath();
        for (let x = 0; x <= this.w; x += 12) { const yy = y + Math.sin(x * 0.03 + this.t + i) * (1 + i * 0.4); if (x) ctx.lineTo(x, yy); else ctx.moveTo(x, yy); }
        ctx.stroke();
      }
    }
    drawParachutes(ctx, this.w / 2, this.h * 0.62, Math.min(this.w, this.h) * 0.2, this.t, 0.4 + 0.6 * this.chutesOpen);
  }

  /** The capsule's window: a thick rounded frame, so every scene out there is seen from inside. */
  private drawWindow(): void {
    const ctx = this.ctx, u = this.u();
    const m = 10 * u, r = 38 * u;
    ctx.save();
    ctx.fillStyle = '#1b222b';
    ctx.beginPath();
    ctx.rect(-20, -20, this.w + 40, this.h + 40);
    ctx.roundRect(m, m, this.w - 2 * m, this.h - 2 * m, r);
    ctx.fill('evenodd');
    ctx.strokeStyle = '#46505c'; ctx.lineWidth = 3 * u;
    ctx.beginPath(); ctx.roundRect(m, m, this.w - 2 * m, this.h - 2 * m, r); ctx.stroke();
    // a faint reflection on the glass
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.beginPath(); ctx.moveTo(m + r, m); ctx.lineTo(m + r + this.w * 0.18, m); ctx.lineTo(m, m + this.h * 0.4); ctx.lineTo(m, m + r); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- drawing: the worlds round you

  protected drawBeast(v: View, b: Beast): void {
    const sp = spot(v, b.x, b.z, b.lift);
    if (!sp.on && Math.abs(sp.off) > (v.w / v.f) / 2 + 1.2) return;
    const ctx = this.ctx;
    if (b.kind === 'iss') drawISS(ctx, sp.x, sp.y, Math.max(this.w, this.h) * 0.11, this.t, Math.sin(b.orbit!.a));
    else if (b.kind === 'lander') drawLander(ctx, sp.x, sp.y, sp.s, this.t);
    else if (b.kind === 'tube') drawTube(ctx, sp.x, sp.y, sp.s, this.t);
  }

  protected worldItems(v: View): Array<{ d: number; draw: () => void }> {
    const ctx = this.ctx;
    const out: Array<{ d: number; draw: () => void }> = [];
    if (this.scene === 'pad') {
      out.push({ d: 150, draw: () => { const sp = spot(v, 18, 150); if (sp.on) drawRocketOnPad(ctx, sp.x, sp.y, sp.s, this.t, 1); } });
      out.push({ d: 3.2, draw: () => {
        const sp = spot(v, -1.1, 3.2);
        if (sp.on) drawGuide(ctx, sp.x, sp.y, sp.s * 0.75, { pose: this.flags.has('spotted') ? 'cheer' : 'point', t: this.t, facing: 1, saying: isSpeaking() ? 0.5 + 0.5 * Math.sin(this.t * 12) : 0 });
      } });
    }
    const ground = this.scene === 'moon' ? MOON_GROUND : MARS_GROUND;
    for (const r of this.rocks) {
      out.push({ d: Math.hypot(r.x, r.z), draw: () => {
        const sp = spot(v, r.x, r.z);
        if (!sp.on || sp.dist < 0.8) return;
        if (r.kind === 'crater') drawCrater(ctx, sp.x, sp.y, sp.s, r.size, ground);
        else drawStone(ctx, sp.x, sp.y, sp.s, r.size, r.seed, this.scene === 'moon' ? '#8e8b84' : '#a45a36');
      } });
    }
    // bootprints round the lander, going out and back the way the astronauts walked
    if (this.beast?.kind === 'lander') {
      const b = this.beast;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU * 1.3, d = 2.6 + (i % 7) * 0.45;
        const px = b.x + Math.sin(a) * d + (i % 2 ? 0.12 : -0.12), pz = b.z + Math.cos(a) * d;
        out.push({ d: Math.hypot(px, pz) + 0.01, draw: () => { const sp = spot(v, px, pz); if (sp.on) drawBootprint(ctx, sp.x, sp.y, sp.s, a); } });
      }
    }
    if (this.scene === 'sea') {
      // the recovery ship coming to pick you up, far off towards the sunrise
      out.push({ d: 400, draw: () => {
        const sp = spot(v, Math.sin(0.35) * 400, Math.cos(0.35) * 400);
        if (!sp.on) return;
        const s = sp.s, x = sp.x, y = sp.y;
        ctx.fillStyle = '#26303a';
        ctx.beginPath(); ctx.moveTo(x - 60 * s, y - 4 * s); ctx.lineTo(x + 60 * s, y - 4 * s); ctx.lineTo(x + 52 * s, y + 3 * s); ctx.lineTo(x - 55 * s, y + 3 * s); ctx.closePath(); ctx.fill();
        ctx.fillRect(x - 20 * s, y - 16 * s, 26 * s, 12 * s);
        ctx.fillRect(x - 4 * s, y - 26 * s, 4 * s, 10 * s);
      } });
    }
    return out;
  }

  protected drawOver(v: View): void {
    const ctx = this.ctx, u = this.u();
    if (this.scene === 'sea') {
      // waves: lines on the water that move, and the path of the sun on it
      const hz = v.horizon, sx = screenX(v, 0.5);
      for (let k = 0; k < 36; k++) {
        const y = hz + (this.h - hz) * Math.pow(k / 36, 1.8) + 2;
        const spread = 8 + (y - hz) * 0.5;
        ctx.fillStyle = 'rgba(255, 215, 170, 0.35)';
        ctx.fillRect(sx - spread / 2 + Math.sin(this.t * 1.5 + k * 1.7) * spread * 0.3, y, spread * (0.3 + 0.3 * Math.sin(k * 3.1)), Math.max(1, (y - hz) * 0.03));
      }
      ctx.strokeStyle = 'rgba(255, 230, 200, 0.18)'; ctx.lineWidth = 1.2;
      for (let k = 0; k < 14; k++) {
        const y = hz + (this.h - hz) * Math.pow(k / 14, 1.7) + 4;
        ctx.beginPath();
        for (let x = 0; x <= this.w; x += 10) {
          const a = v.yaw + (x - this.w / 2) / v.f;
          const yy = y + Math.sin(a * 14 + this.t * 1.1 + k * 2) * (1 + k * 0.5);
          if (x) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
        }
        ctx.stroke();
      }
    }
    // the robot arm, from the bottom of the window, and a pulse on the claw until it is picked up
    if (this.scene === 'mars' && (this.waiting() === 'grabbed' || this.holding) && this.drop === 0) {
      const a = this.armBase(), c = this.clawAt();
      drawArm(ctx, a.x, a.y, c.x, c.y, a.len, this.holding ? 1 : 0, this.holding, this.t);
      if (!this.claw && !this.holding) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + 0.35 * Math.sin(this.t * 5)})`;
        ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.arc(c.x, c.y, 34 * u, 0, TAU); ctx.stroke();
      }
    }
    if (this.scene === 'mars' && this.drop > 0) {
      // coming down on the thrusters: dust blowing up from below
      ctx.fillStyle = `rgba(200, 140, 95, ${0.3 * (1 - this.drop)})`;
      ctx.fillRect(0, this.h * 0.6, this.w, this.h * 0.4);
    }
    if (this.flashT > 0) { ctx.fillStyle = `rgba(240, 250, 255, ${this.flashT * 0.6})`; ctx.fillRect(0, 0, this.w, this.h); }
  }

  protected drawUi(): void {
    const ctx = this.ctx, u = this.u();
    if (this.photoOn) this.drawPhotoScreen();
    const w = this.waiting();
    const b = this.sideButton();
    if (w === 'launched' || w === 'boosted') {
      const pulse = this.held === 'go' ? 0 : Math.sin(this.t * 4) * 0.5 + 0.5;
      ctx.save();
      ctx.globalAlpha = 0.25 * pulse;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.roundRect(b.x - 6 * u, b.y - 6 * u, b.w + 12 * u, b.h + 12 * u, 22 * u); ctx.fill();
      ctx.restore();
      this.button('go', w === 'launched' ? T('Start', 'Start') : T('Faster', 'Gas'), b.x, b.y, b.w, b.h, '#e8743b', '#ffffff');
    } else if (w === 'chutes') {
      this.button('chute', T('Parachutes', 'Parachutes'), b.x, b.y, b.w, b.h, '#f2c14e', '#25506e');
    }
    // the name of what was found, small, under it, until you start moving on
    const bs = this.beastScreen();
    if (this.beast && this.flags.has('found') && bs.on && this.drop === 0 && !(w === 'boosted' && this.boost > 0)) {
      const name = this.beast.kind === 'iss' ? T('space station', 'ruimtestation') : this.beast.kind === 'lander' ? 'Apollo 11' : T('sample tube', 'monsterbuisje');
      ctx.textAlign = 'center';
      ctx.font = this.font('900', 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(name, bs.sx, Math.min(this.h - 110 * u, bs.sy + (this.beast.kind === 'iss' ? 70 : 30) * u));
    }
  }

  /** Stip's last photo: Saturn and its rings, and a small blinking light between them. */
  private drawPhotoScreen(): void {
    const ctx = this.ctx, u = this.u();
    const s = this.photoRect();
    ctx.fillStyle = '#20252c';
    ctx.beginPath(); ctx.roundRect(s.x - 8 * u, s.y - 8 * u, s.w + 16 * u, s.h + 16 * u, 12 * u); ctx.fill();
    ctx.fillStyle = '#02040a';
    ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(s.x, s.y, s.w, s.h); ctx.clip();
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 3) * 0.2})`;
      ctx.fillRect(s.x + ((i * 97.3) % s.w), s.y + ((i * 53.1) % s.h), 1.2 * u, 1.2 * u);
    }
    const photo = planetPhoto('saturn');
    if (photo) drawPhoto(ctx, photo, s.x + s.w * 0.42, s.y + s.h * 0.5, s.h * 0.24);
    const on = (this.t % 1.2) < 0.4;
    if (on) {
      const g = ctx.createRadialGradient(s.sx, s.sy, 0, s.sx, s.sy, 14 * u);
      g.addColorStop(0, 'rgba(255, 110, 90, 0.95)'); g.addColorStop(1, 'rgba(255, 110, 90, 0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.sx, s.sy, 14 * u, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = on ? '#ffd8d0' : '#8a3a30';
    ctx.beginPath(); ctx.arc(s.sx, s.sy, 2.5 * u, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.font = this.font('800', 11);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 220, 180, 0.9)';
    ctx.fillText(T('STIP · last photo', 'STIP · laatste foto'), s.x + 8 * u, s.y + 16 * u);
    if (this.spottedT > 0) {
      ctx.strokeStyle = `rgba(255, 210, 190, ${this.spottedT})`;
      ctx.lineWidth = 3 * u;
      ctx.beginPath(); ctx.arc(s.sx, s.sy, (1.4 - this.spottedT) * 40 * u, 0, TAU); ctx.stroke();
    }
  }

  protected facingOf(): -1 | 1 { return 1; }
}

