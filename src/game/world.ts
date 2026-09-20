import { add, angleDiff, clamp, dist, fromAngle, lerp, mul, norm, pointSegment, resample, smoothPolyline, sub, turnToward, TAU, type Vec } from '../util/math';
import { makeRng, ValueNoise } from '../util/rng';
import { sfx, haptic } from '../util/audio';
import { lang, t } from '../i18n';
import { PLANE_TYPES, runwayAccepts } from './planes';
import type { GameEvent, LevelDef, Plane, PlaneType, RunwayKind, Snapshot } from './types';
import { effects as upgradeEffects } from './upgrades';
import { Weather, makeScript } from './weather';
import { addParallelRunway, initAirports, isGroundState, startArrivalTaxi, updateGround } from './ground';
import { translateAirport, type Airport } from './airport';

export const SEP_GAP = 60;      // metres of clear air required between hulls
export const CRASH_GAP = 10;    // metres: closer than this is a collision
export const RING_EXTRA = SEP_GAP / 2; // ring radius = hull + 30, rings touch at 60 m gap
export const GATE_DIST = 70;    // gate sits this far before the threshold
export const GATE_R = 52;       // pointer capture radius around the gate
export const WIND_UNITS_PER_KMH = 0.3;
export const WORLD_H = 1600;

export interface Runway {
  id: string;
  kind: RunwayKind;
  threshold: Vec;
  heading: number;
  dir: Vec;
  length: number;
  end: Vec;
  gate: Vec;
  occupiedBy: number | null;
  center: Vec;
  width: number;
  airport?: Airport;
  parallelOf?: string;
}

export interface Toast { text: string; until: number; kind: 'info' | 'warn' | 'bad' | 'good' }
export interface Puff { pos: Vec; t0: number; kind: 'crash' | 'land' | 'spawn' | 'lock' | 'tire'; dir?: number }

export interface Failure {
  kind: 'crash' | 'hearts';
  planes: number[];
  t: number;
  gap: number;
}

export type WorldStatus = 'running' | 'failed' | 'complete';

const rot = (a: Vec, b: Vec): number => Math.atan2(b.y - a.y, b.x - a.x);

export class World {
  W: number;
  H = WORLD_H;
  level: LevelDef;
  planes: Plane[] = [];
  runways: Runway[] = [];
  time = 0;
  landed = 0;
  hearts = 3;
  maxHearts = 3;
  nearMisses = 0;
  timeScale = 1;
  slowmoCharges = 0;
  slowmoMax = 0;
  slowmoUntil = -1;
  coinsEarned = 0;
  fx = upgradeEffects();
  onEvent: ((e: GameEvent) => void) | null = null;
  status: WorldStatus = 'running';
  failure: Failure | null = null;
  goalReached = false;
  endless = false;
  demo = false;
  events: GameEvent[] = [];
  snapshots: Snapshot[] = [];
  toasts: Toast[] = [];
  puffs: Puff[] = [];
  selected: number | null = null;
  selectedUntil = 0;
  wind = { vec: { x: 0, y: 0 }, kmh: 0, dirRad: 0 };
  /** how far the whole field was nudged to sit comfortably on screen */
  shift: Vec = { x: 0, y: 0 };
  weather!: Weather;
  private lastWxKind = '';
  private rng: () => number;
  private gustNoise: ValueNoise;
  private nextId = 1;
  private spawnTimer: number;
  private snapTimer = 0;
  private trailTimer = 0;
  private lastRingConflict = new Map<string, number>();
  /** fed by the renderer so wind particle field and gusts can share noise */
  windNoise: ValueNoise;

  constructor(level: LevelDef, worldWidth: number, opts: { demo?: boolean } = {}) {
    this.level = level;
    this.W = worldWidth;
    this.demo = !!opts.demo;
    this.rng = makeRng(level.seed * 7919 + Math.floor(Math.random() * 1e6));
    this.gustNoise = new ValueNoise(level.seed + 5);
    this.windNoise = new ValueNoise(level.seed + 9);
    this.spawnTimer = this.demo ? 0.2 : level.spawn.first;
    this.maxHearts = this.demo ? 3 : this.fx.hearts;
    this.hearts = this.maxHearts;
    this.slowmoMax = this.demo ? 0 : this.fx.slowmoCharges;
    this.slowmoCharges = this.slowmoMax;
    this.runways = level.runways.map(r => {
      const threshold = { x: r.x * this.W, y: r.y * this.H };
      const dir = fromAngle(r.heading);
      const end = add(threshold, mul(dir, r.length));
      const width = r.kind === 'long' ? 46 : r.kind === 'short' ? 34 : r.kind === 'water' ? 60 : 44;
      return {
        id: r.id, kind: r.kind, threshold, heading: r.heading, dir, length: r.length, end,
        gate: r.kind === 'helipad' ? { ...threshold } : sub(threshold, mul(dir, GATE_DIST)),
        occupiedBy: null,
        center: add(threshold, mul(dir, r.length / 2)),
        width,
      };
    });
    const script = level.weather ?? makeScript(level.wind ? 'breezy' : 'clear', 0, level.wind, level.time === 'night');
    this.weather = new Weather(script, this.W, this.H, level.seed);
    initAirports(this);
    if (level.twinRunway && !level.port) {
      const main = this.runways.find(r => r.kind === 'long' && r.airport && !r.parallelOf);
      if (main && main.airport) {
        const ap = main.airport;
        const dirN = { x: -main.dir.y, y: main.dir.x };
        // put the second runway on the opposite side of the terminal
        const termSide = Math.sign((ap.footprint.x - main.center.x) * dirN.x + (ap.footprint.y - main.center.y) * dirN.y) || 1;
        const off = -termSide * (main.width + 150);
        const threshold = add(main.threshold, mul(dirN, off));
        const end = add(threshold, mul(main.dir, main.length));
        const twin: Runway = {
          id: main.id + 'B', kind: 'long', threshold, heading: main.heading, dir: main.dir, length: main.length, end,
          gate: sub(threshold, mul(main.dir, GATE_DIST)), occupiedBy: null, center: add(threshold, mul(main.dir, main.length / 2)), width: main.width,
          airport: ap, parallelOf: main.id,
        };
        this.runways.push(twin);
        addParallelRunway(ap, twin, main);
      }
    }
    this.centreField();
    this.updateWind(0);
  }

  emit(kind: GameEvent['kind'], planes: number[], text: string, meta?: Record<string, number | string>): void { this.pushEvent(kind, planes, text, meta); }

  /**
   * Nudges every runway and airport so the whole field sits in the middle of the screen: fully
   * centred left to right, and vertically only far enough to clear the HUD and the panel.
   */
  private centreField(): void {
    const rwPts: Vec[] = [];
    const allPts: Vec[] = [];
    for (const rw of this.runways) {
      const perp = { x: -rw.dir.y, y: rw.dir.x };
      for (const a of [-GATE_DIST - 30, rw.length + 20]) for (const s of [-1, 1]) {
        const p = add(add(rw.threshold, mul(rw.dir, a)), mul(perp, (rw.width / 2 + 12) * s));
        rwPts.push(p); allPts.push(p);
      }
    }
    if (!rwPts.length) return;
    for (const ap of this.airports()) {
      const f = ap.footprint;
      const c = Math.cos(f.rot), sn = Math.sin(f.rot);
      for (const sx of [-0.5, 0.5]) for (const sy of [-0.5, 0.5]) {
        const lx = sx * f.w, ly = sy * f.h;
        allPts.push({ x: f.x + lx * c - ly * sn, y: f.y + lx * sn + ly * c });
      }
    }
    const box = (pts: Vec[]): { x0: number; x1: number; y0: number; y1: number } => ({
      x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)),
      y0: Math.min(...pts.map(p => p.y)), y1: Math.max(...pts.map(p => p.y)),
    });
    const r = box(rwPts), all = box(allPts);
    // the band you can comfortably reach with a thumb: below the counter card, above the aircraft panel
    const HUD_TOP = 200, PANEL = 330, SIDE = 30;
    // the runways must stay well inside; the surrounding complex may hang over the edge a little
    const SLACK = 240;
    const aim = (rLo: number, rHi: number, aLo: number, aHi: number, lo: number, hi: number, span: number): number => {
      const target = (lo + hi) / 2 - (rLo + rHi) / 2;   // centre the runways in the reachable band
      let min = Math.max(-SLACK - aLo, 24 - rLo);
      let max = Math.min(span + SLACK - aHi, span - 24 - rHi);
      if (min > max) { min = 24 - rLo; max = span - 24 - rHi; }
      return min > max ? (min + max) / 2 : clamp(target, min, max);
    };
    const dx = aim(r.x0, r.x1, all.x0, all.x1, SIDE, this.W - SIDE, this.W);
    const dy = aim(r.y0, r.y1, all.y0, all.y1, HUD_TOP, this.H - PANEL, this.H);
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const d = { x: dx, y: dy };
    this.shift = d;
    for (const rw of this.runways) {
      rw.threshold = add(rw.threshold, d);
      rw.end = add(rw.end, d);
      rw.center = add(rw.center, d);
      rw.gate = add(rw.gate, d);
    }
    for (const ap of this.airports()) translateAirport(ap, d);
  }

  /** Every distinct airport complex on this map. */
  airports(): Airport[] {
    const out: Airport[] = [];
    for (const r of this.runways) if (r.airport && !out.includes(r.airport)) out.push(r.airport);
    return out;
  }

  // ---------- public API used by input/UI ----------

  planeAt(p: Vec, radius = 46): Plane | null {
    let best: Plane | null = null, bd = radius;
    for (const pl of this.planes) {
      if (pl.state !== 'flying') continue;
      const d = dist(pl.pos, p) - pl.type.hull * 0.5;
      if (d < bd) { bd = d; best = pl; }
    }
    return best;
  }

  planeById(id: number): Plane | undefined { return this.planes.find(p => p.id === id); }

  beginPath(plane: Plane): void {
    plane.path = [];
    plane.pathIndex = 0;
    plane.lockedRunway = null;
    plane.hold = false; plane.evadeUntil = -1;
    plane.pathDrawnAt = this.time;
    sfx.pathStart();
  }

  /** Called continuously while drawing. Returns the runway id when the path locks onto a gate. */
  setPath(plane: Plane, raw: Vec[]): string | null {
    if (plane.state !== 'flying') return null;
    const pts = smoothPolyline(resample(raw, 7), 1);
    plane.path = pts;
    this.syncPathIndex(plane);
    const last = raw[raw.length - 1];
    for (const rw of this.runways) {
      if (dist(last, rw.gate) > GATE_R) continue;
      if (!runwayAccepts(rw.kind, plane.type)) {
        this.toast(`${plane.type.name} ${t('wrongRunwayHint')}`, 'warn', 1.6);
        return null;
      }
      const tail: Vec[] = rw.kind === 'helipad'
        ? [rw.gate]
        : [rw.gate, add(rw.threshold, mul(rw.dir, 10))];
      plane.path = smoothPolyline(resample([...raw, ...tail], 7), 1);
      // keep the final approach exactly straight so alignment is honest
      if (rw.kind !== 'helipad') {
        plane.path.push(add(rw.threshold, mul(rw.dir, 14)));
      }
      this.syncPathIndex(plane);
      plane.lockedRunway = rw.id;
      this.pushEvent('lock', [plane.id], `${plane.type.name} → ${this.runwayName(rw)}`, { runway: rw.id });
      this.puffs.push({ pos: { ...rw.gate }, t0: this.time, kind: 'lock' });
      sfx.pathLock(); haptic('light');
      return rw.id;
    }
    return null;
  }

  endPath(plane: Plane): void {
    if (plane.path.length < 2) { plane.path = []; return; }
    this.pushEvent('path', [plane.id], `${plane.type.name}: route`, { locked: plane.lockedRunway ?? '' });
  }

  select(plane: Plane | null): void {
    this.selected = plane ? plane.id : null;
    this.selectedUntil = plane ? this.time + 1e9 : 0;
  }

  /** Where this aircraft will actually go in the next seconds, wind and route included. */
  predictTrack(p: Plane, seconds = 8, step = 0.25): Vec[] {
    const out: Vec[] = [];
    let pos = { ...p.pos }, heading = p.heading, idx = p.pathIndex;
    const sens = p.type.windSensitivity * (this.demo ? 1 : this.fx.windFactor);
    const speed = p.type.speed * p.boost * (1 - 0.18 * p.ice);
    const r = Math.max(13, speed * 0.2, (speed / p.type.turnRate) * 0.55);
    for (let tt = 0; tt < seconds; tt += step) {
      let desired = heading;
      if (p.path.length > 0 && idx < p.path.length) {
        while (idx < p.path.length - 1 && dist(p.path[idx], pos) < r) idx++;
        if (idx < p.path.length) desired = rot(pos, p.path[idx]);
      }
      heading = turnToward(heading, desired, p.type.turnRate * (1 - 0.3 * p.ice) * step);
      pos = add(pos, mul(add(fromAngle(heading, speed), mul(this.weather.vec, sens)), step));
      out.push({ ...pos });
    }
    return out;
  }

  continueEndless(): void {
    this.endless = true;
    this.status = 'running';
  }

  /** Rewarded-ad revive: one heart back, wreckage cleared, play on. */
  revive(): void {
    this.planes = this.planes.filter(p => p.state !== 'crashed');
    for (const p of this.planes) p.conflictWith.clear();
    this.hearts = 1;
    this.failure = null;
    this.status = 'running';
    this.toast(t('revive').split(' (')[0], 'good', 2);
  }

  /** ATC commands for the selected aircraft. Returns false when not applicable right now. */
  command(p: Plane, cmd: 'faster' | 'slower' | 'tcas' | 'hold'): boolean {
    if (p.state !== 'flying' || this.status !== 'running') return false;
    const NL = lang() === 'nl';
    switch (cmd) {
      case 'faster':
        if (p.boost > 1) return false;
        p.boost = p.type.family === 'fighter' ? 1.35 : 1.25; p.boostUntil = this.time + 14;
        this.pushEvent('command', [p.id], NL ? 'sneller' : 'faster', { cmd });
        this.toast(`${p.type.name}: ${NL ? 'snelheid omhoog, ruimere bocht' : 'speed up, wider turns'}`, 'info', 2);
        return true;
      case 'slower':
        if (p.boost < 1) return false;
        p.boost = 0.72; p.boostUntil = this.time + 16;
        this.pushEvent('command', [p.id], NL ? 'langzamer' : 'slower', { cmd });
        this.toast(`${p.type.name}: ${NL ? 'snelheid omlaag' : 'reduce speed'}`, 'info', 2);
        return true;
      case 'tcas': {
        // resolution advisory: break away from the nearest traffic, drop the route
        let nearest: Plane | null = null, nd = Infinity;
        for (const o of this.planes) { if (o === p || (o.state !== 'flying' && o.state !== 'landing')) continue; const d = dist(o.pos, p.pos); if (d < nd) { nd = d; nearest = o; } }
        p.path = []; p.pathIndex = 0; p.lockedRunway = null; p.hold = false;
        p.evadeUntil = this.time + 5;
        const away = nearest ? rot(nearest.pos, p.pos) : p.heading;
        // store the escape heading in wanderTimer-free field: reuse turbSeed sign trick is ugly, so keep a map
        this.evadeHeading.set(p.id, away);
        this.pushEvent('command', [p.id], 'TCAS', { cmd, with: nearest ? nearest.id : -1 });
        this.toast(`${p.type.name}: TCAS ${NL ? 'uitwijken' : 'resolution'}`, 'warn', 2);
        haptic('medium');
        return true;
      }
      case 'hold':
        p.path = []; p.pathIndex = 0; p.lockedRunway = null; p.evadeUntil = -1;
        p.hold = !p.hold;
        this.pushEvent('command', [p.id], p.hold ? (NL ? 'wachtrondje' : 'hold') : (NL ? 'wachtrondje beëindigd' : 'hold cancelled'), { cmd });
        this.toast(`${p.type.name}: ${p.hold ? (NL ? 'in wachtrondje' : 'holding') : (NL ? 'wachtrondje beëindigd' : 'hold cancelled')}`, 'info', 2);
        return true;
    }
    return false;
  }
  private evadeHeading = new Map<number, number>();

  activateSlowmo(): boolean {
    if (this.status !== 'running' || this.slowmoCharges <= 0 || this.slowmoUntil > this.time) return false;
    this.slowmoCharges--;
    this.slowmoUntil = this.time + 6;
    this.timeScale = 0.5;
    sfx.slowmo(true); haptic('medium');
    return true;
  }

  runwayName(rw: Runway): string {
    if (/^\d{2}[LCR]?$/.test(rw.id)) return `${lang() === 'nl' ? 'baan' : 'runway'} ${rw.id}`;
    const base = rw.kind === 'short' ? t('rwShort') : rw.kind === 'long' ? t('rwLong') : rw.kind === 'water' ? t('rwWater') : t('rwHeli');
    const twin = rw.parallelOf ? rw : this.runways.find(r => r.parallelOf === rw.id);
    if (!twin) return base;
    // left/right as seen by a landing pilot
    const other = rw.parallelOf ? this.runwayById(rw.parallelOf)! : twin;
    const cross = -rw.dir.y * (other.threshold.x - rw.threshold.x) + rw.dir.x * (other.threshold.y - rw.threshold.y);
    const right = cross < 0;
    return `${base} ${right ? (lang() === 'nl' ? 'rechts' : 'right') : (lang() === 'nl' ? 'links' : 'left')}`;
  }

  runwayById(id: string | null | undefined): Runway | undefined { return id ? this.runways.find(r => r.id === id) : undefined; }
  airportById(id: string | null | undefined): Airport | undefined {
    if (!id) return undefined;
    for (const r of this.runways) if (r.airport && r.airport.id === id) return r.airport;
    return undefined;
  }

  maxConcurrent(): number {
    const s = this.level.spawn;
    const p = clamp(this.landed / this.level.goal, 0, 1.6);
    return Math.round(lerp(s.maxConcurrent, s.maxConcurrentEnd, p)) + (this.endless ? Math.floor((this.landed - this.level.goal) / 6) : 0);
  }

  toast(text: string, kind: Toast['kind'] = 'info', dur = 2.2): void {
    const last = this.toasts[this.toasts.length - 1];
    if (last && last.text === text) { last.until = this.time + dur; return; }
    this.toasts.push({ text, until: this.time + dur, kind });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  // ---------- main update ----------

  update(dt: number): void {
    if (this.status !== 'running') return;
    dt = Math.min(dt, 0.05);
    if (this.slowmoUntil > 0 && this.time >= this.slowmoUntil) { this.slowmoUntil = -1; this.timeScale = 1; sfx.slowmo(false); }
    dt *= this.timeScale;
    this.time += dt;
    this.updateWind(dt);
    this.spawnLogic(dt);

    for (const p of this.planes) this.updatePlane(p, dt);

    if (!this.demo) this.checkSeparation();

    // cleanup
    this.planes = this.planes.filter(p => !(p.state === 'landed' && this.time - p.landingT > 0.6) && !(p.state === 'crashed' && this.time - p.landingT > 6));
    this.toasts = this.toasts.filter(tt => tt.until > this.time);
    this.puffs = this.puffs.filter(pf => this.time - pf.t0 < 3);

    // recording for the post-mortem
    this.snapTimer += dt; this.trailTimer += dt;
    if (this.snapTimer >= 0.1) {
      this.snapTimer = 0;
      this.snapshots.push({
        t: this.time,
        planes: this.planes.map(p => ({ id: p.id, x: p.pos.x, y: p.pos.y, h: p.heading, state: p.state, alt: p.altitude, path: p.path, lock: p.lockedRunway, cross: p.crossTrack })),
      });
      if (this.snapshots.length > 160) this.snapshots.shift();
    }
    if (this.trailTimer >= 0.09) {
      this.trailTimer = 0;
      for (const p of this.planes) {
        if (p.state === 'flying' || p.state === 'landing') {
          p.trail.push({ ...p.pos });
          if (p.trail.length > 34) p.trail.shift();
        }
      }
    }

    if (!this.demo && !this.goalReached && this.landed >= this.level.goal) {
      this.goalReached = true;
      this.status = 'complete';
      sfx.fanfare(); haptic('medium');
    }
  }

  private updateWind(dt: number): void {
    this.weather.update(dt, this.time);
    this.wind = { vec: this.weather.vec, kmh: this.weather.kmhNow, dirRad: this.weather.dirRad };
    if (!this.demo) {
      const k = this.weather.kind();
      if (k !== this.lastWxKind) {
        if (this.lastWxKind) {
          const msg: Record<string, [string, string]> = { clear: ['Het klaart op', 'Clearing up'], breezy: ['Wind trekt aan', 'Wind picking up'], rain: ['Regen op komst', 'Rain moving in'], fog: ['Mist trekt binnen', 'Fog rolling in'], storm: ['Onweerscel nadert', 'Storm cell approaching'], ice: ['IJzel: risico op ijsafzetting', 'Freezing rain: icing risk'] };
          this.toast(msg[k][lang() === 'nl' ? 0 : 1], k === 'clear' ? 'good' : 'warn', 3);
        }
        this.lastWxKind = k;
      }
    }
  }

  // ---------- spawning ----------

  private pickType(): PlaneType {
    const pool = this.level.planes;
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let r = this.rng() * total;
    for (const p of pool) { r -= p.weight; if (r <= 0) return PLANE_TYPES[p.type]; }
    return PLANE_TYPES[pool[0].type];
  }

  private spawnLogic(dt: number): void {
    this.spawnTimer -= dt;
    const active = this.planes.filter(p => p.state === 'flying').length;
    const cap = this.demo ? 5 : this.maxConcurrent();
    if (this.spawnTimer > 0 || active >= cap) return;
    if (this.spawn()) {
      const s = this.level.spawn;
      const base = Math.max(s.min, s.base - this.landed * s.step);
      this.spawnTimer = (this.demo ? 4 : base) * (0.85 + this.rng() * 0.3);
    } else {
      this.spawnTimer = 0.8;
    }
  }

  private spawn(): boolean {
    const type = this.pickType();
    for (let attempt = 0; attempt < 8; attempt++) {
      const side = this.rng();
      let pos: Vec;
      if (side < 0.5) pos = { x: lerp(0.08, 0.92, this.rng()) * this.W, y: -70 };
      else if (side < 0.75) pos = { x: -70, y: lerp(0.04, 0.55, this.rng()) * this.H };
      else pos = { x: this.W + 70, y: lerp(0.04, 0.55, this.rng()) * this.H };
      // aim at a random point in the middle band of the sea
      const target = { x: lerp(0.25, 0.75, this.rng()) * this.W, y: lerp(0.28, 0.5, this.rng()) * this.H };
      const heading = rot(pos, target);
      // never spawn into a conflict: check current distance and a few seconds of straight-line prediction
      let tooClose = false;
      const vNew = fromAngle(heading, type.speed);
      for (const o of this.planes) {
        if (o.state === 'landed' || o.state === 'crashed') continue;
        const vO = fromAngle(o.heading, o.speed);
        for (let tt = 0; tt <= 9 && !tooClose; tt += 0.75) {
          const a = add(pos, mul(vNew, tt)), b = add(o.pos, mul(vO, tt));
          if (dist(a, b) < 190 + o.type.hull + type.hull) tooClose = true;
        }
        if (tooClose) break;
      }
      if (tooClose) continue;
      const plane: Plane = {
        id: this.nextId++, type, pos, heading, speed: type.speed, state: 'flying', path: [], pathIndex: 0,
        lockedRunway: null, pathDrawnAt: -1, landingT: 0, runway: null, altitude: 1, crossTrack: 0,
        spawnedAt: this.time, trail: [], conflictWith: new Set(), bank: 0, livery: Math.floor(this.rng() * 3), goArounds: 0,
        wanderTimer: 0, fuel: type.fuel > 0 && !this.demo ? type.fuel : -1, urgent: type.fuel > 0 && !this.demo, ice: 0, turbSeed: this.rng() * 100, boost: 1, boostUntil: -1, hold: false, evadeUntil: -1, ground: null, gateId: null, parkUntil: 0, airportId: null, takeoffAlong: 0, outbound: false,
      };
      this.planes.push(plane);
      this.puffs.push({ pos: { ...pos }, t0: this.time, kind: 'spawn', dir: heading });
      this.pushEvent('spawn', [plane.id], type.name);
      if (plane.urgent) {
        this.toast(`${type.name}: ${lang() === 'nl' ? 'brandstof voor' : 'fuel for'} ${Math.round(plane.fuel)} s`, 'warn', 3);
        this.pushEvent('mayday', [plane.id], `${type.name}: ${lang() === 'nl' ? 'voorrang, brandstoftekort' : 'priority, low fuel'}`, { fuel: Math.round(plane.fuel) });
      }
      return true;
    }
    return false;
  }

  // ---------- flight ----------

  private syncPathIndex(plane: Plane): void {
    if (plane.path.length === 0) { plane.pathIndex = 0; return; }
    let best = 0, bd = Infinity;
    for (let i = 0; i < plane.path.length; i++) {
      const d = dist(plane.path[i], plane.pos);
      if (d < bd - 0.5) { bd = d; best = i; }
    }
    plane.pathIndex = best;
    this.advanceIndex(plane);
  }

  private advanceIndex(plane: Plane): void {
    // big jets cannot turn tightly: accept a waypoint from farther away so they never orbit it
    const turnRadius = plane.speed / plane.type.turnRate;
    const r = Math.max(13, plane.speed * 0.2, turnRadius * 0.55);
    while (plane.pathIndex < plane.path.length - 1 && dist(plane.path[plane.pathIndex], plane.pos) < r) plane.pathIndex++;
    if (plane.pathIndex >= plane.path.length - 1 && dist(plane.path[plane.path.length - 1], plane.pos) < r) {
      plane.pathIndex = plane.path.length; // consumed
    }
  }

  private updatePlane(p: Plane, dt: number): void {
    if (p.state === 'crashed' || p.state === 'landed') return;
    if (p.state === 'landing') { this.updateLanding(p, dt); return; }
    if (isGroundState(p.state) || p.state === 'departing') { updateGround(this, p, dt); return; }
    if (p.urgent && p.fuel > 0) {
      p.fuel -= dt;
      if (p.fuel <= 0) { this.ditch(p); return; }
    }

    let desired = p.heading;
    let turnScale = 1;
    if (p.path.length > 0 && p.pathIndex < p.path.length) {
      const before = p.pathIndex;
      this.advanceIndex(p);
      // stall guard: no progress for a long time means we are circling a waypoint we cannot reach
      if (p.pathIndex === before) {
        p.wanderTimer += dt;
        if (p.wanderTimer > 3.5) { p.pathIndex++; p.wanderTimer = 0; }
      } else p.wanderTimer = 0;
      if (p.pathIndex < p.path.length) {
        const tgt = p.path[Math.min(p.path.length - 1, p.pathIndex)];
        desired = rot(p.pos, tgt);
        // cross-track error for wind feedback
        const i0 = Math.max(0, p.pathIndex - 1);
        p.crossTrack = pointSegment(p.pos, p.path[i0], p.path[Math.min(p.path.length - 1, i0 + 1)]).d;
      }
    }
    if (p.pathIndex >= p.path.length && p.path.length > 0) {
      // path consumed
      const rw = this.runwayById(p.lockedRunway);
      if (rw) { this.tryLand(p, rw); if (p.state !== 'flying') return; }
      else { p.path = []; p.crossTrack = 0; }
    }

    if (p.boostUntil > 0 && this.time >= p.boostUntil) { p.boost = 1; p.boostUntil = -1; }
    if (p.evadeUntil > this.time) {
      desired = this.evadeHeading.get(p.id) ?? p.heading;
      turnScale = 1.4;
    } else if (p.hold && p.path.length === 0) {
      // standard holding circle: keep a steady bank
      desired = p.heading + 1;
      turnScale = 0.55;
    } else if (p.path.length === 0) {
      // unguided: fly straight, but turn back gently when leaving the map
      const m = 30;
      const out = p.pos.x < -m || p.pos.x > this.W + m || p.pos.y < -m || p.pos.y > this.H + m;
      const center = { x: this.W / 2, y: this.H * 0.42 };
      const toC = sub(center, p.pos);
      const vel = fromAngle(p.heading);
      if (out && (vel.x * toC.x + vel.y * toC.y) < 0) {
        desired = rot(p.pos, center) + (this.demo ? 0 : 0.35 * Math.sign(this.rng() - 0.5));
        turnScale = 0.7;
      } else if (this.demo) {
        p.wanderTimer -= dt;
        if (p.wanderTimer <= 0) { p.wanderTimer = 2 + this.rng() * 3; p.bank = 0; }
        desired = p.heading + Math.sin(this.time * 0.3 + p.id) * 0.4;
      }
    }

    // weather: turbulence knocks the nose around, ice slows and stiffens the aircraft
    const wxs = this.weather.sample(p.pos);
    const sens = p.type.windSensitivity * (this.demo ? 1 : this.fx.windFactor);
    if (wxs.turb > 0.02) {
      const n = this.weather['noise'] as ValueNoise;
      const j = n.noise2(this.time * 1.9 + p.turbSeed, p.turbSeed) * 2 - 1;
      p.heading += j * wxs.turb * sens * 1.3 * dt;
      p.bank += j * wxs.turb * sens * 0.6 * dt;
    }
    if (!this.demo) {
      const rate = this.weather.icingRate(p.type);
      if (rate > 0) { const was = p.ice; p.ice = Math.min(1, p.ice + rate * dt); if (was < 0.5 && p.ice >= 0.5) this.toast(`${p.type.name}: ${lang() === 'nl' ? 'ijsafzetting, trager en stroever' : 'icing, slower and sluggish'}`, 'warn', 3); }
    }
    const iceTurn = 1 - 0.3 * p.ice;
    p.speed = p.type.speed * p.boost * (1 - 0.18 * p.ice) * (1 + (wxs.turb > 0.02 ? ((this.weather['noise'] as ValueNoise).noise2(this.time * 1.1, p.turbSeed + 9) - 0.5) * 0.16 * wxs.turb * sens : 0));
    const before = p.heading;
    p.heading = turnToward(p.heading, desired, p.type.turnRate * iceTurn * turnScale * dt);
    const turning = angleDiff(before, p.heading) / Math.max(dt, 1e-4);
    p.bank = lerp(p.bank, clamp(turning / p.type.turnRate, -1, 1), 1 - Math.exp(-dt * 5));

    // a locked final approach: sink gently as the threshold nears
    const rwL = this.runwayById(p.lockedRunway);
    if (rwL && rwL.kind !== 'helipad') {
      const d = dist(p.pos, rwL.threshold);
      p.altitude = clamp(0.35 + 0.65 * (d / 260), 0.35, 1);
    } else if (rwL) {
      const d = dist(p.pos, rwL.threshold);
      p.altitude = clamp(0.35 + 0.65 * (d / 160), 0.35, 1);
    } else {
      p.altitude = lerp(p.altitude, 1, 1 - Math.exp(-dt * 2));
    }

    const vel = fromAngle(p.heading, p.speed);
    const wind = mul(this.wind.vec, p.type.windSensitivity * (this.demo ? 1 : this.fx.windFactor));
    p.pos = add(p.pos, mul(add(vel, wind), dt));

    // helicopter: can land when hovering near the pad even without a locked path
    if (p.type.cls === 'heli' && p.lockedRunway) {
      const rw = this.runwayById(p.lockedRunway);
      if (rw && dist(p.pos, rw.threshold) < 18) this.tryLand(p, rw);
    }
  }

  private tryLand(p: Plane, rw: Runway): void {
    const kindOk = runwayAccepts(rw.kind, p.type);
    const busy = rw.occupiedBy !== null && rw.occupiedBy !== p.id;
    let reason: string | null = null;
    const wx = this.weather;
    const comp = wx.components(rw.heading);
    const vis = wx.visibility();
    const ilsOk = p.type.ils || this.fx.alignBonus > 1;
    const storm = wx.sample(rw.gate).storm;
    const NL = lang() === 'nl';
    if (!kindOk) reason = t('tooShort');
    else if (busy) reason = t('runwayBusy');
    else if (!this.demo && !(vis >= p.type.minVis || (ilsOk && vis >= 300))) reason = NL ? `zicht ${vis} m onder minima` : `visibility ${vis} m below minima`;
    else if (!this.demo && rw.kind !== 'helipad' && comp.cross > p.type.crosswindLimit) reason = NL ? `zijwind ${Math.round(comp.cross)} km/u boven limiet ${p.type.crosswindLimit}` : `crosswind ${Math.round(comp.cross)} km/h above limit ${p.type.crosswindLimit}`;
    else if (!this.demo && rw.kind === 'water' && wx.seaState > p.type.seaLimit) reason = NL ? 'golven te hoog' : 'waves too high';
    else if (!this.demo && storm > 0.45) reason = NL ? 'windschering in de onweerscel' : 'wind shear in the storm cell';
    else if (rw.kind !== 'helipad') {
      const align = Math.abs(angleDiff(p.heading, rw.heading));
      const lateral = Math.abs(pointSegment(p.pos, sub(rw.threshold, mul(rw.dir, 300)), rw.end).d);
      const maxAlign = (p.type.cls === 'heavy' ? 0.42 : p.type.cls === 'medium' ? 0.5 : 0.62) * this.fx.alignBonus;
      if (align > maxAlign || lateral > (rw.width * 0.5 + 6) * this.fx.alignBonus) reason = t('misaligned');
    }
    if (reason) {
      // go-around
      p.path = []; p.lockedRunway = null; p.pathIndex = 0; p.goArounds++;
      this.pushEvent('goaround', [p.id], `${t('goAround')}: ${reason}`, { reason });
      this.toast(`${t('goAround')} · ${p.type.name}: ${reason}`, 'warn', 2.6);
      sfx.goAround(); haptic('medium');
      return;
    }
    p.state = 'landing';
    p.runway = rw.id;
    p.landingT = 0;
    p.path = [];
    rw.occupiedBy = p.id;
    this.pushEvent('touchdown', [p.id], p.type.name, { heavy: p.type.cls === 'heavy' || p.type.cls === 'medium' ? 1 : 0 });
    if (rw.kind !== 'helipad' && rw.kind !== 'water') this.puffs.push({ pos: add(rw.threshold, mul(rw.dir, 30)), t0: this.time, kind: 'tire', dir: rw.heading });
    // store the entry offset so we can blend onto the centre line
    (p as unknown as { entryOffset: Vec }).entryOffset = sub(p.pos, rw.threshold);
  }

  private updateLanding(p: Plane, dt: number): void {
    const rw = this.runwayById(p.runway)!;
    if (rw.kind === 'helipad') {
      p.landingT += dt / 1.7;
      const k = 1 - Math.exp(-dt * 3);
      p.pos = { x: lerp(p.pos.x, rw.threshold.x, k), y: lerp(p.pos.y, rw.threshold.y, k) };
      p.speed = lerp(p.speed, 0, k);
      p.altitude = clamp(0.35 * (1 - p.landingT), 0, 0.35);
      p.heading += dt * 0.4;
    } else {
      // decelerate along the runway
      const target = p.type.speed * 0.3;
      p.speed = lerp(p.speed, target, 1 - Math.exp(-dt * 1.3));
      p.landingT += (p.speed * dt) / rw.length;
      const along = p.landingT * rw.length;
      const eo = (p as unknown as { entryOffset: Vec }).entryOffset ?? { x: 0, y: 0 };
      // lateral component of the entry offset decays over the first third
      const lat = eo.x * -rw.dir.y + eo.y * rw.dir.x;
      const blend = Math.max(0, 1 - p.landingT / 0.3);
      const perp = { x: -rw.dir.y, y: rw.dir.x };
      p.pos = add(add(rw.threshold, mul(rw.dir, along)), mul(perp, lat * blend));
      p.heading = turnToward(p.heading, rw.heading, dt * 2.5);
      p.altitude = clamp(0.35 * (1 - p.landingT / 0.28), 0, 0.35);
      p.bank = lerp(p.bank, 0, 1 - Math.exp(-dt * 4));
      // release the runway for the next arrival once well down the strip
      const roll = this.weather.rollFactor(p.type);
      if (!rw.airport && p.landingT > Math.min(0.9, this.fx.taxiRelease * roll) && rw.occupiedBy === p.id) rw.occupiedBy = null;
    }
    if (p.landingT >= (rw.kind === 'helipad' ? 1 : Math.min(0.97, 0.86 * this.weather.rollFactor(p.type)))) {
      this.landed++;
      if (rw.kind === 'helipad' || rw.kind === 'water') { p.state = 'landed'; p.landingT = this.time; if (rw.occupiedBy === p.id) rw.occupiedBy = null; }
      else startArrivalTaxi(this, p, rw);
      if (!this.demo) this.coinsEarned += Math.round((p.urgent ? 18 : 6) * this.fx.coinMultiplier);
      if (p.urgent) this.toast(`${p.type.name}: ${lang() === 'nl' ? 'veilig binnen, bonus' : 'safe, bonus'} +${Math.round(12 * this.fx.coinMultiplier)}`, 'good', 2.5);
      this.pushEvent('landed', [p.id], `${p.type.name} ${t('landed').toLowerCase()}`);
      this.puffs.push({ pos: { ...p.pos }, t0: this.time, kind: 'land' });
      sfx.landed(); haptic('light');
    }
  }

  // ---------- separation ----------

  private checkSeparation(): void {
    const airborne = this.planes.filter(p => p.state === 'flying' || ((p.state === 'landing' || p.state === 'takeoff' || p.state === 'departing') && p.altitude > 0.12));
    for (let i = 0; i < airborne.length; i++) {
      for (let j = i + 1; j < airborne.length; j++) {
        const a = airborne[i], b = airborne[j];
        const gap = dist(a.pos, b.pos) - a.type.hull - b.type.hull;
        const key = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
        if (gap <= CRASH_GAP) {
          this.crash(a, b, gap);
          return;
        }
        if (gap < SEP_GAP) {
          if (!a.conflictWith.has(b.id)) {
            a.conflictWith.add(b.id); b.conflictWith.add(a.id);
            this.nearMiss(a, b, gap);
            if (this.status !== 'running') return;
          }
          this.lastRingConflict.set(key, this.time);
        } else if (gap > SEP_GAP + 25) {
          if (a.conflictWith.has(b.id)) { a.conflictWith.delete(b.id); b.conflictWith.delete(a.id); }
        }
      }
    }
  }

  private nearMiss(a: Plane, b: Plane, gap: number): void {
    this.hearts--;
    this.nearMisses++;
    const g = Math.max(0, Math.round(gap));
    this.pushEvent('nearmiss', [a.id, b.id], `${t('nearMiss')}: ${a.type.name} ${lang() === 'nl' ? 'en' : 'and'} ${b.type.name}, ${g} m`, { gap: g });
    this.toast(`${t('nearMiss')} · ${g} m`, 'bad', 2.4);
    sfx.warn(); haptic('heavy');
    if (this.hearts <= 0) {
      this.status = 'failed';
      this.failure = { kind: 'hearts', planes: [a.id, b.id], t: this.time, gap: g };
    }
  }

  /** An urgent arrival ran out of fuel: it is lost and costs a life. */
  private ditch(p: Plane): void {
    p.state = 'crashed';
    p.landingT = this.time;
    p.urgent = false;
    this.puffs.push({ pos: { ...p.pos }, t0: this.time, kind: 'crash' });
    this.hearts--;
    this.pushEvent('ditch', [p.id], `${p.type.name}: ${lang() === 'nl' ? 'brandstof op, noodlanding op zee' : 'out of fuel, ditched at sea'}`);
    this.toast(`${p.type.name}: ${lang() === 'nl' ? 'brandstof op' : 'out of fuel'}`, 'bad', 3);
    sfx.crash(); haptic('heavy');
    if (this.hearts <= 0) {
      this.status = 'failed';
      this.failure = { kind: 'hearts', planes: [p.id, p.id], t: this.time, gap: 0 };
    }
  }

  private crash(a: Plane, b: Plane, gap: number): void {
    a.state = 'crashed'; b.state = 'crashed';
    a.landingT = this.time; b.landingT = this.time;
    const mid = mul(add(a.pos, b.pos), 0.5);
    this.puffs.push({ pos: mid, t0: this.time, kind: 'crash' });
    this.pushEvent('crash', [a.id, b.id], `${t('collision')}: ${a.type.name} ${lang() === 'nl' ? 'en' : 'and'} ${b.type.name}`, { gap: Math.max(0, Math.round(gap)) });
    this.status = 'failed';
    this.failure = { kind: 'crash', planes: [a.id, b.id], t: this.time, gap: Math.max(0, gap) };
    sfx.crash(); haptic('heavy');
  }

  private pushEvent(kind: GameEvent['kind'], planes: number[], text: string, meta?: Record<string, number | string>): void {
    const e: GameEvent = { t: this.time, kind, planes, text, meta };
    this.events.push(e);
    if (this.events.length > 400) this.events.shift();
    if (this.onEvent && !this.demo) this.onEvent(e);
  }

  /** Utility for the renderer: gap between two planes in metres. */
  static gap(a: Plane, b: Plane): number {
    return dist(a.pos, b.pos) - a.type.hull - b.type.hull;
  }
}

export const compassFromRad = (rad: number): number => ((rad * 180 / Math.PI) + 90 + 360) % 360;
export const norm2 = norm;
export const tau = TAU;
