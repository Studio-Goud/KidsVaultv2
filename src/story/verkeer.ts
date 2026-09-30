/**
 * Suri en de fietstocht - the traffic story, on the shared stage (`stage.ts`).
 *
 * The script is in `verkeerscript.ts`. What is particular to this story is here: six places along
 * one short ride to grandma's house, and what a child does in each. Helmet and bell at the front
 * door; walking the bike to the kerb and looking left, right, left, where a car passes only once you
 * have looked; the red cycle path, pedalled by holding a button, with a blue sign to find; a zebra
 * crossing where a car stops and you then walk across; a traffic light you tap go on only when it
 * is green; and grandma's door.
 *
 * It is all the stage's own world: a camera that stands still and turns, with the street laid out
 * round it in metres. The camera does not move, so "riding" is the world sliding past (`travel`):
 * the road, the houses and the lamps move towards you while Suri and his bicycle stay where they
 * are, seen from behind because the child is the one following him.
 *
 * Nothing here can be failed. Going on a red light is a sentence from Suri, looking the wrong way is
 * a hint, a car that has not been looked at simply waits. The one fixed rule is the one the story is
 * about: the car on the road passes only after you have looked.
 */

import { T } from '../util/lang';
import { drawGuide } from '../platform/guide';
import { isSpeaking } from '../platform/voice';
import { ASIDES, CHAPTERS, LOOK_HOLD, LOOK_YAW, RED_MIN, RIDE_LEN, ROAD_NEAR, ROAD_WIDTH, TO_KERB, TO_OMA, type Chapter } from './verkeerscript';
import { wrapAngle } from './look';
import { spot, type Palette, type PropKind, type View } from './world';
import {
  drawBell, drawBikeSide, drawBikeSign, drawBush, drawCar, drawFence, drawHelmet, drawHouse,
  drawLamp, drawRiderBack, drawTrafficLight, groundQuad, helmetOnGuide, type Lamp,
} from './verkeerart';
import { bed, verkeerSfx, type Bed } from './verkeersfx';
import { Stage, type Beast } from './stage';
import type { Aside } from './tale';

type Scene = Chapter['id'];

interface Car {
  x: number; z: number; dir: 1 | -1; v: number; colour: string; wheel: number;
  /** a car that drives past; one that stops for the zebra crossing; one that crosses in front of the light */
  kind: 'pass' | 'stop' | 'cross';
  /** the car the child is asked to find; the stage tracks it as the `beast` */
  beast?: boolean;
  braking?: boolean;
  leaving?: boolean;
}

/** A fine day in a Dutch street: pale sky, green lawns, far trees. One palette, because it is one ride on one morning. */
const DAY: Palette = {
  skyTop: '#66b2e8', skyLow: '#e3f2fa', sun: '#fff3c0', sunAt: 0.9, sunUp: 0.55,
  cloud: '#ffffff', clouds: 6, far: '#a4c59a', mid: '#86b278', ground: '#8cc068', groundNear: '#6fa64f', haze: '#d3e8ee', treeline: '#5f9352',
};

// Speeds and distances. Real figures where there is one, otherwise product decisions.
/** Walking the bike, m/s: a child's walking pace is about 1 to 1.3 (real); 1.3 is the brisk end so holding the button is not long. */
const WALK = 1.3;
/** Pedalling, m/s: about 11 km/h, a child on a small bike (real order of magnitude). */
const TOP = 3.2;
/** Cars in a residential street move at 30 km/h at most (the Dutch 30 zone); 6 m/s is 22 km/h. */
const CAR_V = 6;
/** The lane nearest to us carries traffic from left to right, because traffic keeps to the right. */
const LANE_NEAR = ROAD_NEAR + ROAD_WIDTH * 0.25;
const LANE_FAR = ROAD_NEAR + ROAD_WIDTH * 0.75;
/** Where the car stops for the zebra crossing: its nose a little before the stripes, which start at x = -1.8. */
const STOP_X = -4.5;
const CAR_COLOURS = ['#e8743b', '#3f8ff0', '#f7c531', '#4fae6e', '#d8402f', '#8a5fb0'];

const NUDGES: Record<string, Aside> = {
  helmet: ASIDES.helmet, bell: ASIDES.bell, rang: ASIDES.bell, stopped: ASIDES.stop,
  atkerb: ASIDES.hold, pedaled: ASIDES.hold, arrived: ASIDES.hold, crossed: ASIDES.hold,
  left: ASIDES.left, left2: ASIDES.left, right: ASIDES.right,
};

export class Verkeer extends Stage {
  protected readonly id = 'verkeer';
  protected readonly chapters: Chapter[] = CHAPTERS;
  protected readonly title = { en: 'Suri and the bike ride', nl: 'Suri en de fietstocht' };
  protected get lookAround(): Aside { return this.scene === 'zebrapad' ? ASIDES.findCar : ASIDES.lookAround; }

  private scene: Scene = 'thuis';
  /** metres the world has slid past: the camera never moves, so this is how a ride is made */
  private travel = 0;
  private propBase: number[] = [];
  private speed = 0;
  private phase = 0;
  private cars: Car[] = [];
  private fadeIn = 0;

  // thuis
  private helmetOn = false;
  private fly: { t: number } | null = null;
  private ring = 0;
  private head = { x: 0, y: 0, size: 100 };

  // looking
  private lookT = 0;
  /** seconds until the car comes, once the child has looked left: it arrives while Suri is saying it is coming */
  private passIn = -1;
  private passSent = false;

  // the light
  private light: Lamp = 'red';
  private goT = 0;
  private spawnT = 0;
  private shakeGo = 0;

  // stopping and crossing
  private autoWalk = false;
  private autoRide = false;

  // grandma
  private doorT = 0;

  private idleT = 0;
  private nagged = false;
  private lastWait: string | null = null;
  private playing: Bed | null = null;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.run();
  }

  protected debugExtra(): Record<string, unknown> {
    return {
      scene: this.scene, travel: Math.round(this.travel * 10) / 10, speed: Math.round(this.speed * 10) / 10,
      helmet: this.helmetOn, light: this.light, lookT: Math.round(this.lookT * 100) / 100,
      cars: this.cars.map(c => ({ x: Math.round(c.x * 10) / 10, v: Math.round(c.v * 10) / 10, kind: c.kind })),
      door: Math.round(this.doorT * 100) / 100,
    };
  }

  // ---------------------------------------------------------------- palettes

  protected palette(): Palette { return DAY; }

  // ---------------------------------------------------------------- chapters and cues

  protected setup(c: Chapter): void {
    this.scene = c.id;
    this.travel = 0; this.speed = 0; this.phase = 0;
    this.cars = []; this.beast = null; this.life = null;
    this.autoWalk = false; this.autoRide = false;
    this.lookT = 0; this.passIn = -1; this.passSent = false; this.idleT = 0; this.nagged = false; this.lastWait = null;
    this.light = 'red'; this.goT = 0; this.spawnT = 0.6; this.shakeGo = 0;
    this.fadeIn = c.id === 'thuis' ? 0 : 1;
    this.ring = 0;
    if (c.id === 'thuis') { this.helmetOn = false; this.fly = null; }
    if (c.id === 'oma') this.doorT = 0;
    if (c.id !== 'thuis') this.helmetOn = true;
    this.buildProps();
  }

  protected cue(name: string): void {
    if (name === 'cross') this.autoWalk = true;
    else if (name === 'car') this.sendStopCar();
    else if (name === 'ride') this.autoRide = true;
    else if (name === 'grandma') {
      this.doorT = 0.001;
      verkeerSfx.door();
      const u = this.u();
      this.ps.spawn('heart', this.w / 2, this.h * 0.4, 8, { colour: '#f07a8c', speed: 110, size: 9 * u, max: 1.4, spread: 1.6, grav: -20 });
    } else if (name === 'end') {
      verkeerSfx.done();
      this.helmetOn = false;
      this.finished = true;
      this.markSeen();
    }
  }

  protected ambience(): void {
    if (!this.started) return;
    const want: Bed = this.scene === 'thuis' ? 'home' : this.scene === 'fietspad' ? 'path' : this.scene === 'oma' ? 'oma' : 'street';
    if (want === this.playing) return;
    this.playing = want;
    bed(want);
  }

  destroy(): void { super.destroy(); bed(null); }

  protected onFound(b: Beast): void {
    verkeerSfx.found();
    const bs = this.beastScreen();
    if (b.kind === 'sign' && bs.on) this.ps.spawn('ring', bs.sx, bs.sy - 100 * this.u(), 1, { colour: '#ffffff', size: 40 * this.u(), max: 0.9 });
  }

  // ---------------------------------------------------------------- the worlds

  private addProp(kind: PropKind, x: number, z: number, size: number): void {
    this.props.push({ kind, x, z, size, seed: this.props.length * 7.3 + 1 });
    this.propBase.push(z);
  }

  /** Things that stand in the ground and slide past as a prop: trees, hedges, flowers, tufts. */
  private buildProps(): void {
    this.props = []; this.propBase = [];
    const sc = this.scene;
    // a small deterministic scatter so the lawn is the same every time a child comes back
    let a = 17;
    const r = (): number => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    if (sc === 'thuis') {
      for (const x of [-3.3, -7, -10.6, 3.3, 7, 10.6]) this.addProp('hedge', x, 8.4, 0.9);
      this.addProp('tree', -6.5, 5.5, 1.3); this.addProp('tree', 7, 4.5, 1.2); this.addProp('tree', -14, 10, 1.5); this.addProp('tree', 15, 9, 1.4);
      for (let i = 0; i < 26; i++) {
        const x = (r() < 0.5 ? -1 : 1) * (1.4 + r() * 6), z = 0.5 + r() * 7;
        this.addProp(i % 3 ? 'flower' : 'tuft', x, z, 1 + r() * 0.8);
      }
    } else if (sc === 'fietspad') {
      for (let k = -3; k < 26; k++) { this.addProp('hedge', 4.6, k * 3.6, 0.9); this.addProp('hedge', -3.7, k * 3.6 + 1.8, 0.9); }
      for (let k = -1; k < 11; k++) { this.addProp('tree', 7.6, 4 + k * 9, 1.3); this.addProp('tree', -6.8, 8 + k * 11, 1.4); }
      for (let i = 0; i < 60; i++) {
        const side = r() < 0.5 ? -1 : 1, x = side > 0 ? 1.9 + r() * 2.2 : -3.6 + r() * 1.1;
        this.addProp(i % 3 ? 'tuft' : 'flower', x, -4 + r() * 90, 1 + r() * 0.8);
      }
    } else if (sc === 'oma') {
      for (const x of [-3.3, 3.3, -10.6, 10.6]) this.addProp('hedge', x, 8.6, 0.9);
      this.addProp('tree', -7, 11, 1.4); this.addProp('tree', 8, 12, 1.3); this.addProp('tree', -15, 7, 1.5); this.addProp('tree', 16, 8, 1.4);
      for (let i = 0; i < 40; i++) {
        const x = (r() < 0.5 ? -1 : 1) * (1.3 + r() * 6.5), z = -2 + r() * 12;
        this.addProp(i % 2 ? 'flower' : 'tuft', x, z, 1 + r() * 0.9);
      }
    } else {
      // a street: trees on both pavements, and a little grass beyond the far one
      for (const x of [-16, -8, 7.5, 17]) this.addProp('tree', x, 2.2, 1.3);
      for (const x of [-12, -4, 5, 13]) this.addProp('tree', x, 15, 1.2);
      for (let i = 0; i < 30; i++) this.addProp(i % 2 ? 'tuft' : 'flower', -20 + r() * 40, 27 + r() * 6, 1 + r() * 0.6);
    }
    this.syncProps();
  }

  private syncProps(): void {
    for (let i = 0; i < this.props.length; i++) this.props[i].z = this.propBase[i] - this.travel;
  }

  /** Where the camera's own group - Suri and the bike - stands, in metres ahead: further off on a wide, short screen so his feet are in view. */
  private groupZ(): number {
    const f = this.view().f;
    return Math.max(2.4, (1.2 * f) / (0.3 * this.h));
  }

  private groupX(): number {
    return this.scene === 'fietspad' ? 0.45 : 0.3;
  }

  private sendStopCar(): void {
    const c: Car = { x: -32, z: LANE_NEAR, dir: 1, v: CAR_V, colour: CAR_COLOURS[1], wheel: 0, kind: 'stop', beast: true };
    this.cars = [c];
    verkeerSfx.carPass();
    // the stage follows the car as the thing to find; its coordinates are relative to the camera
    this.beast = { kind: 'car', x: c.x, z: c.z - this.travel, speed: 0, heading: 0, phase: 0, stride: 1, head: 0, jaw: 0, lift: 0 };
  }

  private spawnPass(): void {
    this.cars.push({ x: -26, z: LANE_NEAR, dir: 1, v: CAR_V, colour: CAR_COLOURS[0], wheel: 0, kind: 'pass' });
    verkeerSfx.carPass();
  }

  // ---------------------------------------------------------------- per frame

  protected tick(dt: number): void {
    const w = this.waiting();
    this.fadeIn = Math.max(0, this.fadeIn - dt * 1.2);
    this.ring = Math.max(0, this.ring - dt * 1.6);
    this.shakeGo = Math.max(0, this.shakeGo - dt);
    this.doorT = this.doorT > 0 ? Math.min(1, this.doorT + dt * 1.2) : 0;
    if (this.fly) { this.fly.t += dt / 0.6; if (this.fly.t >= 1) { this.fly = null; this.helmetOn = true; } }

    // a hint, once, when the child has not done the thing for a while
    if (w !== this.lastWait) { this.lastWait = w; this.idleT = 0; this.nagged = false; }
    if (w && NUDGES[w] && this.held === null) {
      this.idleT += dt;
      if (this.idleT > 9 && !this.nagged && !isSpeaking()) { this.nagged = true; this.aside(NUDGES[w]); }
    }

    this.moveCars(dt);
    this.moveBike(dt, w);
    this.looking(dt, w);
    this.scenes(dt, w);
    this.syncProps();
    if (this.beast && this.beast.kind === 'car') {
      const c = this.cars.find(k => k.beast);
      if (c) { this.beast.x = c.x; this.beast.z = c.z - this.travel; }
    }
    this.ambience();
  }

  private moveCars(dt: number): void {
    for (const c of this.cars) {
      if (c.kind === 'stop') {
        if (c.leaving) c.v = Math.min(CAR_V, c.v + 1.6 * dt);
        else if (c.braking) c.v = Math.max(0, c.v - 1.6 * dt);
        else if (c.x > STOP_X - (CAR_V * CAR_V) / (2 * 1.6)) { c.braking = true; verkeerSfx.carStop(); }
      }
      c.x += c.v * c.dir * dt;
      c.wheel += (c.v * dt) / 0.3 * c.dir;
    }
    this.cars = this.cars.filter(c => (c.dir > 0 ? c.x < 27 : c.x > -27));
    if (this.beast?.kind === 'car' && !this.cars.some(c => c.beast)) this.beast = null;
  }

  /** Walking the bike, pedalling it, and the world sliding past. */
  private moveBike(dt: number, w: string | null): void {
    let v = 0;
    if (this.scene === 'stoep') {
      if (w === 'atkerb' && this.held === 'walk') { v = WALK; if (this.travel + v * dt >= TO_KERB) { this.travel = TO_KERB; this.flags.add('atkerb'); v = 0; } }
      if (this.autoWalk) { v = WALK; if (this.travel >= ROAD_NEAR + ROAD_WIDTH + 1.2) { this.travel = ROAD_NEAR + ROAD_WIDTH + 1.2; this.autoWalk = false; this.flags.add('over'); v = 0; } }
    } else if (this.scene === 'zebrapad') {
      if (w === 'stopped') { v = WALK * 0.7; if (this.travel + v * dt >= 3.4) { this.travel = 3.4; this.flags.add('stopped'); v = 0; } }
      if (w === 'crossed' && this.held === 'walk') { v = WALK; if (this.travel + v * dt >= ROAD_NEAR + ROAD_WIDTH + 1.2) { this.flags.add('crossed'); v = 0; } }
    } else if (this.scene === 'stoplicht') {
      if (this.autoRide) { v = 2.4; if (this.travel + v * dt >= ROAD_NEAR + ROAD_WIDTH + 1.6) { this.autoRide = false; this.flags.add('over'); v = 0; } }
    }
    if (this.scene === 'fietspad' || this.scene === 'oma') {
      const pedalling = this.held === 'pedal' && (w === 'pedaled' || w === 'arrived');
      const top = this.scene === 'oma' ? TOP * 0.9 : TOP;
      this.speed = pedalling ? Math.min(top, this.speed + 2.4 * dt) : Math.max(0, this.speed - 3 * dt);
      v = this.speed;
      if (this.scene === 'fietspad' && w === 'pedaled' && this.travel >= RIDE_LEN) { this.flags.add('pedaled'); this.beastForSign(); }
      if (this.scene === 'oma') {
        if (this.travel >= TO_OMA) { this.travel = TO_OMA; this.speed = 0; v = 0; if (!this.flags.has('arrived')) { this.flags.add('arrived'); verkeerSfx.arrive(); } }
      }
    } else this.speed = v;
    const before = this.phase;
    this.travel += v * dt;
    this.phase += (v / 0.35) * dt;
    // a soft tick on every turn of the pedals while riding
    if (v > 0 && (this.scene === 'fietspad' || this.scene === 'oma') && Math.floor((this.phase * 0.6) / Math.PI) !== Math.floor((before * 0.6) / Math.PI)) verkeerSfx.pedal();
  }

  /** The sign the child is asked to find: off to the right, where a sign stands, so there is some turning to do. */
  private beastForSign(): void {
    if (this.beast) return;
    this.beast = { kind: 'sign', x: 3.6, z: 1.0, speed: 0, heading: 0, phase: 0, stride: 1, head: 0, jaw: 0, lift: 0 };
  }

  /** Looking left, right and left again: the camera has to be turned far enough, for long enough. */
  private looking(dt: number, w: string | null): void {
    if (this.scene !== 'stoep') return;
    if (w !== 'left' && w !== 'left2' && w !== 'right') { this.lookT = 0; return; }
    const yaw = wrapAngle(this.look.yaw);
    const ok = w === 'right' ? yaw > LOOK_YAW : yaw < -LOOK_YAW;
    this.lookT = ok ? this.lookT + dt : 0;
    if (this.lookT >= LOOK_HOLD) {
      this.flags.add(w);
      this.lookT = 0;
      // a car comes only when you have looked: the first time you look left
      if (w === 'left') this.passIn = 2.6;
    }
  }

  private scenes(dt: number, w: string | null): void {
    if (this.scene === 'stoep') {
      if (this.passIn > 0) { this.passIn -= dt; if (this.passIn <= 0) { this.spawnPass(); this.passSent = true; } }
      if (w === 'carPassed' && this.passSent && !this.cars.some(c => c.kind === 'pass')) this.flags.add('carPassed');
    } else if (this.scene === 'zebrapad') {
      const c = this.cars.find(k => k.beast);
      if (c && c.braking && c.v === 0 && !c.leaving) this.flags.add('carStill');
      // once we are across, the car goes on its way
      if (c && this.flags.has('crossed')) c.leaving = true;
    } else if (this.scene === 'stoplicht') {
      // cars cross in front of us while it is red; it turns green when the road is empty
      const calm = w === 'go';
      if (calm) this.goT += dt;
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.light === 'red' && (!calm || this.goT < 3)) {
        const fromLeft = this.cars.length % 2 === 0;
        this.cars.push({
          x: fromLeft ? -24 : 24, z: fromLeft ? LANE_NEAR : LANE_FAR, dir: fromLeft ? 1 : -1, v: CAR_V + (this.cars.length % 3) * 0.5,
          colour: CAR_COLOURS[(this.spawnCount++) % CAR_COLOURS.length], wheel: 0, kind: 'cross',
        });
        verkeerSfx.carPass();
        this.spawnT = 3.2;
      }
      if (calm && this.light === 'red' && this.goT >= RED_MIN && this.cars.length === 0) {
        this.light = 'green';
        verkeerSfx.lightClick();
        verkeerSfx.green();
        // the word "go" is on the button; say when it is time to use it, so the old "wait" is not left on the screen
        this.aside(ASIDES.green);
      }
    }
  }
  private spawnCount = 0;

  // ---------------------------------------------------------------- the child's hands

  protected press(id: string): void {
    super.press(id);
    this.idleT = 0;
    const w = this.waiting();
    if (id === 'helm' && w === 'helmet' && !this.fly) {
      this.flags.add('helmet');
      this.fly = { t: 0 };
      verkeerSfx.helmet();
    } else if (id === 'bel' && (w === 'bell' || w === 'rang')) {
      this.ring = 1;
      verkeerSfx.bell();
      this.flags.add(w);
      const u = this.u();
      this.ps.spawn('ring', this.w * 0.5, this.h * 0.5, 1, { colour: '#ffffff', size: 50 * u, max: 0.8 });
    } else if (id === 'stop' && w === 'stopped') {
      this.flags.add('stopped');
    } else if (id === 'ga' && w === 'go') {
      if (this.light === 'green') this.flags.add('go');
      else { this.aside(ASIDES.wait); this.shakeGo = 0.5; }
    }
  }

  // ---------------------------------------------------------------- drawing

  protected worldItems(v: View): Array<{ d: number; draw: () => void }> {
    const ctx = this.ctx, tz = this.travel;
    const out: Array<{ d: number; draw: () => void }> = [];
    const at = (x: number, z: number, draw: (sp: ReturnType<typeof spot>) => void): void => {
      const rz = z - tz;
      out.push({ d: Math.hypot(x, rz), draw: () => { const sp = spot(v, x, rz); if (sp.on) draw(sp); } });
    };

    // the ground goes first, under everything standing on it
    out.push({ d: 1e5, draw: () => this.drawGround(v) });

    const sc = this.scene;
    const house = (x: number, z: number, w: number, h: number, wall: string, roof: string, extra: { door?: number; grandma?: boolean; flowers?: boolean; doorAt?: number } = {}): void =>
      at(x, z, sp => drawHouse(ctx, sp.x, sp.y, sp.s, { w, h, wall, roof, t: this.t, ...extra }));

    if (sc === 'thuis') {
      house(0, 12, 7.5, 5, '#c86a4a', '#5a4a52');
      house(-9.5, 13, 6.5, 4.6, '#d9a66a', '#6a4a3a'); house(9.5, 13, 6.5, 4.6, '#b85a4a', '#4a4a5a');
      house(-20, 14, 7, 4.8, '#cf8a5a', '#5a4a52'); house(20, 14, 7, 4.8, '#d9b87a', '#6a4a3a');
    } else if (sc === 'oma') {
      house(1.6, 16, 8.5, 5.2, '#e9c46a', '#8a4a3a', { doorAt: -0.3, door: this.doorT, grandma: this.doorT > 0.3, flowers: true });
      house(-9.5, 17, 6.5, 4.6, '#d9a66a', '#6a4a3a'); house(13.5, 17, 6.5, 4.6, '#c86a4a', '#4a4a5a');
      at(-4.4, 9, sp => drawFence(ctx, sp.x, sp.y, sp.s, 6.2)); at(4.4, 9, sp => drawFence(ctx, sp.x, sp.y, sp.s, 6.2));
      for (const [x, z, sd] of [[-2.6, 14.6, 1], [2.6, 14.6, 4], [-5.5, 14.2, 7], [5.6, 14.2, 9]] as Array<[number, number, number]>) at(x, z, sp => drawBush(ctx, sp.x, sp.y, sp.s, sd, true));
    } else if (sc === 'fietspad') {
      const walls = ['#c86a4a', '#d9a66a', '#b85a4a', '#cf8a5a', '#d9b87a'];
      for (let k = 0; k < 8; k++) { house(-16 + (k % 2) * 4, 30 + k * 13, 7, 4.8, walls[k % 5], '#5a4a52'); house(16 - (k % 2) * 3, 34 + k * 13, 7, 4.8, walls[(k + 2) % 5], '#6a4a3a'); }
      for (let k = -1; k < 12; k++) at(-3.0, k * 10, sp => drawLamp(ctx, sp.x, sp.y, sp.s));
    } else {
      // a street: a row of houses on the far side, lamps on both kerbs
      const walls = ['#c86a4a', '#d9a66a', '#b85a4a', '#cf8a5a', '#d9b87a'];
      for (let k = -3; k <= 3; k++) house(k * 11, 30, 8, 5.4, walls[(k + 3) % 5], k % 2 ? '#5a4a52' : '#6a4a3a');
      for (const x of [-11, 11]) at(x, ROAD_NEAR - 0.6, sp => drawLamp(ctx, sp.x, sp.y, sp.s));
      if (sc === 'stoplicht') at(2.3, ROAD_NEAR - 1.2, sp => drawTrafficLight(ctx, sp.x, sp.y, sp.s, this.light, this.t));
    }

    // cars on the road (the one the child looks for is drawn by the stage as the `beast`)
    for (const c of this.cars) {
      if (c.beast) continue;
      at(c.x, c.z, sp => drawCar(ctx, sp.x, sp.y, sp.s, { colour: c.colour, dir: c.dir, wheel: c.wheel }));
    }

    // Suri and his bicycle, which stay where they are while the world slides past
    const gz = this.groupZ(), gx = this.groupX();
    if (sc === 'thuis') {
      out.push({ d: Math.hypot(gx, gz), draw: () => this.drawAtHome(v) });
    } else {
      out.push({ d: Math.hypot(gx, gz), draw: () => {
        const sp = spot(v, gx, gz);
        const mode = sc === 'fietspad' ? 'ride' : sc === 'stoplicht' ? (this.autoRide ? 'ride' : 'wait') : sc === 'oma' ? (this.flags.has('arrived') ? 'wait' : 'ride') : 'walk';
        drawRiderBack(ctx, sp.x, sp.y, sp.s, { mode, phase: this.phase, helmet: this.helmetOn, t: this.t, ring: this.ring });
      } });
    }
    return out;
  }

  /** Suri standing by his bicycle at the front door, the helmet on him or not yet. */
  private drawAtHome(v: View): void {
    const ctx = this.ctx;
    const gz = Math.max(3.4, this.groupZ() * 1.4);
    const bike = spot(v, 0.35, gz), suri = spot(v, -1.0, gz);
    drawBikeSide(ctx, bike.x, bike.y, bike.s, { phase: 0, ring: this.ring });
    const size = 1.15 * suri.s;
    drawGuide(ctx, suri.x, suri.y, size, { pose: this.fly || this.ring > 0 ? 'cheer' : 'watch', t: this.t, facing: 1, saying: isSpeaking() ? 0.5 + 0.5 * Math.sin(this.t * 12) : 0 });
    this.head = { x: suri.x, y: suri.y, size };
    if (this.helmetOn) helmetOnGuide(ctx, suri.x, suri.y, size);
  }

  private drawGround(v: View): void {
    const ctx = this.ctx, tz = this.travel;
    const Z = (z: number): number => z - tz;
    const PAVE = '#cfcac0', KERB = '#ebe7dc', ASPHALT = '#6d737c', LINE = '#f1f1ea';
    const sc = this.scene;
    if (sc === 'thuis' || sc === 'oma') {
      // the garden path up to the door, with flagstones
      const end = sc === 'oma' ? 15.6 : 11.8;
      const px0 = sc === 'oma' ? -1.9 : -0.95, px1 = sc === 'oma' ? 1.0 : 0.95;
      groundQuad(ctx, v, px0, px1, Z(-14), Z(end), '#d8c9a8', 1.4);
      ctx.fillStyle = '#c8b894'; ctx.strokeStyle = '#c8b894';
      for (let z = Math.floor(tz / 0.9) * 0.9 - 4; z < end; z += 0.9) groundQuad(ctx, v, px0, px1, Z(z), Z(z + 0.05), '#c8b894', 2);
    } else if (sc === 'fietspad') {
      // a road on the left, the lawn, the red path, a footpath: each with its own colour, so what is for bikes can be seen
      groundQuad(ctx, v, -10.4, -4.4, Z(-14), Z(110), ASPHALT, 2);
      for (let z = Math.floor(tz / 4) * 4 - 12; z < tz + 100; z += 4) groundQuad(ctx, v, -7.45, -7.35, Z(z), Z(z + 2), LINE, 2);
      groundQuad(ctx, v, -2.4, 1.6, Z(-14), Z(110), '#c9553f', 2);
      groundQuad(ctx, v, -2.42, -2.3, Z(-14), Z(110), '#f4ddd6', 2);
      groundQuad(ctx, v, 1.5, 1.62, Z(-14), Z(110), '#f4ddd6', 2);
      for (let z = Math.floor(tz / 3) * 3 - 12; z < tz + 100; z += 3) groundQuad(ctx, v, -0.5, -0.4, Z(z), Z(z + 1), '#f4ddd6', 2);
      groundQuad(ctx, v, 1.62, 3.4, Z(-14), Z(110), PAVE, 2);
    } else {
      // a street across in front of us: pavement, kerb, road, kerb, pavement
      groundQuad(ctx, v, -80, 80, Z(-20), Z(ROAD_NEAR - 0.4), PAVE, 2.5);
      ctx.lineWidth = 1;
      for (let z = Math.floor((tz - 3) / 0.8) * 0.8; z < ROAD_NEAR - 0.4; z += 0.8) groundQuad(ctx, v, -9, 9, Z(z), Z(z + 0.03), '#bdb8ae', 3);
      for (let x = -8.8; x < 9; x += 0.8) groundQuad(ctx, v, x, x + 0.03, Z(Math.max(-3, tz - 3)), Z(ROAD_NEAR - 0.4), '#bdb8ae', 3);
      groundQuad(ctx, v, -80, 80, Z(ROAD_NEAR - 0.4), Z(ROAD_NEAR), KERB, 4);
      groundQuad(ctx, v, -80, 80, Z(ROAD_NEAR), Z(ROAD_NEAR + ROAD_WIDTH), ASPHALT, 2.5);
      const mid = ROAD_NEAR + ROAD_WIDTH / 2;
      for (let x = -42; x < 42; x += 3.5) groundQuad(ctx, v, x, x + 1.6, Z(mid - 0.06), Z(mid + 0.06), LINE, 2);
      groundQuad(ctx, v, -80, 80, Z(ROAD_NEAR + ROAD_WIDTH), Z(ROAD_NEAR + ROAD_WIDTH + 0.4), KERB, 4);
      groundQuad(ctx, v, -80, 80, Z(ROAD_NEAR + ROAD_WIDTH + 0.4), Z(27), PAVE, 2.5);
      if (sc === 'zebrapad') {
        // the stripes lie along the road and you walk across them, one after another
        for (let k = 0; k < 6; k++) groundQuad(ctx, v, -1.8, 1.8, Z(ROAD_NEAR + 0.25 + k), Z(ROAD_NEAR + 0.75 + k), '#f6f6f0', 1.2);
      }
    }
  }

  protected drawOver(): void {
    if (this.fadeIn > 0) { this.ctx.fillStyle = `rgba(255, 255, 255, ${this.fadeIn})`; this.ctx.fillRect(0, 0, this.w, this.h); }
  }

  protected drawBeast(v: View, b: Beast): void {
    const sp = spot(v, b.x, b.z);
    if (!sp.on) return;
    const ctx = this.ctx;
    if (b.kind === 'sign') {
      drawBikeSign(ctx, sp.x, sp.y, sp.s);
    } else if (b.kind === 'car') {
      const c = this.cars.find(k => k.beast);
      if (c) drawCar(ctx, sp.x, sp.y, sp.s, { colour: c.colour, dir: c.dir, wheel: c.wheel });
    }
  }

  /** The buttons: only the one the story is waiting on, bottom right, above the words. */
  private actionButton(): { x: number; y: number; w: number; h: number } {
    const u = this.u();
    const bw = 116 * u, bh = 64 * u;
    return { x: this.w - bw - 14 * u, y: this.h - 100 * u - bh, w: bw, h: bh };
  }

  protected drawUi(): void {
    const ctx = this.ctx, u = this.u();
    const w = this.waiting();
    const b = this.actionButton();
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
    const halo = (): void => {
      ctx.save(); ctx.globalAlpha = 0.25 * pulse; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.roundRect(b.x - 6 * u, b.y - 6 * u, b.w + 12 * u, b.h + 12 * u, 22 * u); ctx.fill();
      ctx.restore();
    };
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const caption = (s: string): void => {
      ctx.textAlign = 'center'; ctx.font = this.font('900', 11); ctx.fillStyle = '#25506e';
      ctx.fillText(s, cx, b.y + b.h - 8 * u, b.w - 10);
    };
    if (w === 'helmet' && !this.fly) {
      halo(); this.button('helm', '', b.x, b.y, b.w, b.h, '#fffdf6');
      drawHelmet(ctx, cx, cy + 4 * u, 21 * u); caption(T('Helmet', 'Helm'));
    } else if (w === 'bell' || w === 'rang') {
      halo(); this.button('bel', '', b.x, b.y, b.w, b.h, '#fffdf6');
      drawBell(ctx, cx - 4 * u, cy - 2 * u, 15 * u, this.ring); caption(T('Bell', 'Bel'));
    } else if (w === 'stopped') {
      halo(); this.button('stop', T('Stop', 'Stop'), b.x, b.y, b.w, b.h, '#d8342a', '#ffffff');
    } else if (w === 'atkerb' || w === 'crossed') {
      if (this.held !== 'walk') halo();
      this.button('walk', T('Walk', 'Loop'), b.x, b.y, b.w, b.h, '#4f8fd8', '#ffffff');
    } else if (w === 'pedaled' || w === 'arrived') {
      if (this.held !== 'pedal') halo();
      this.button('pedal', T('Pedal', 'Trap'), b.x, b.y, b.w, b.h, '#e8743b', '#ffffff');
    } else if (w === 'go') {
      if (this.light === 'green') halo();
      const dx = Math.sin(this.t * 50) * this.shakeGo * 6 * u;
      this.button('ga', T('Go', 'Ga'), b.x + dx, b.y, b.w, b.h, this.light === 'green' ? '#3fae5e' : '#9aa5b0', '#ffffff');
    }

    // the helmet flying from the button to Suri's head
    if (this.fly) {
      const k = Math.min(1, this.fly.t), e = k * k * (3 - 2 * k);
      const hx = this.head.x, hy = this.head.y - 61 * (this.head.size / 100);
      const x = cx + (hx - cx) * e, y = cy + (hy - cy) * e - Math.sin(k * Math.PI) * 60 * u;
      const r1 = 15.5 * (this.head.size / 100);
      drawHelmet(ctx, x, y, 21 * u + (r1 - 21 * u) * e);
    }

    // a sign, once found, says what it is
    const bs = this.beastScreen();
    if (this.beast?.kind === 'sign' && this.flags.has('found') && bs.on) {
      ctx.textAlign = 'center'; ctx.font = this.font('900', 15); ctx.fillStyle = '#ffffff';
      ctx.fillText(T('cycle path', 'fietspad'), bs.sx, Math.min(this.h - 110 * u, bs.sy + 28 * u));
    }
    // an arrow at the edge, the short way round, when looking left or right is taking a while
    if ((w === 'left' || w === 'left2' || w === 'right') && this.idleT > 4) {
      const left = w !== 'right';
      const x = left ? 26 * u : this.w - 26 * u, y = this.h * 0.4;
      ctx.save();
      ctx.globalAlpha = 0.55 + 0.35 * Math.sin(this.t * 5);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x + (left ? -12 : 12) * u, y); ctx.lineTo(x + (left ? 10 : -10) * u, y - 16 * u); ctx.lineTo(x + (left ? 10 : -10) * u, y + 16 * u);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}
