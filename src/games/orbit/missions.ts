/**
 * Missions: launching probes at planets that will not sit still.
 *
 * This is the part of Orbit that is a game rather than a picture. You are mission control. Earth
 * is moving, the target is moving, and a probe you push off Earth keeps Earth's speed and falls
 * round the sun on its own path. So you cannot aim at where Mars is; you aim at where Mars will be,
 * and you lean on the sun's pull to bend you there. Going outward means going faster than Earth.
 * Going inward, which feels wrong to everyone the first time, means going slower.
 *
 * The arithmetic is honest two-body gravity, but the map is squeezed: the outer planets sit far
 * closer than they really do, or Neptune would be off every screen. Inside that squeezed map the
 * orbits are still Kepler's, so the lessons transfer: outer planets crawl, inner ones race, and a
 * transfer takes the time it takes.
 */

export interface Body {
  id: string;
  /** display orbit radius; Earth is 1 */
  r: number;
  /** angle at t = 0 */
  phase: number;
  /** drawn radius on screen, as a fraction of the Earth-orbit radius */
  size: number;
  /** how close counts as arriving */
  capture: number;
}

/** The planets on the squeezed map, each with a starting angle so they are spread around the sun. */
export const PLANETS: Body[] = [
  { id: 'mercury', r: 0.42, phase: 0.9, size: 0.018, capture: 0.09 },
  { id: 'venus', r: 0.7, phase: 2.6, size: 0.03, capture: 0.1 },
  { id: 'earth', r: 1.0, phase: 0.0, size: 0.032, capture: 0.1 },
  { id: 'mars', r: 1.42, phase: 4.1, size: 0.024, capture: 0.1 },
  { id: 'jupiter', r: 2.25, phase: 1.7, size: 0.075, capture: 0.16 },
  { id: 'saturn', r: 3.05, phase: 5.2, size: 0.065, capture: 0.16 },
  { id: 'uranus', r: 3.8, phase: 3.4, size: 0.045, capture: 0.13 },
  { id: 'neptune', r: 4.5, phase: 0.6, size: 0.043, capture: 0.13 },
];

/** For the first mission the sun is swapped for Earth and the target is the Moon. */
export const MOON_SYSTEM: Body[] = [
  { id: 'earth', r: 0, phase: 0, size: 0.14, capture: 0 },
  { id: 'moon', r: 1.0, phase: 1.2, size: 0.045, capture: 0.14 },
];

export const GM = 1;

/** Where a body is at time t. Angular speed follows Kepler: slower the further out. */
export function bodyPos(b: Body, t: number): { x: number; y: number } {
  if (b.r === 0) return { x: 0, y: 0 };
  const w = Math.pow(b.r, -1.5) * Math.sqrt(GM);
  const a = b.phase + w * t;
  return { x: Math.cos(a) * b.r, y: Math.sin(a) * b.r };
}

/** Its velocity, for a probe leaving it. */
export function bodyVel(b: Body, t: number): { x: number; y: number } {
  if (b.r === 0) return { x: 0, y: 0 };
  const w = Math.pow(b.r, -1.5) * Math.sqrt(GM);
  const a = b.phase + w * t;
  const v = w * b.r;
  return { x: -Math.sin(a) * v, y: Math.cos(a) * v };
}

export interface Probe {
  x: number; y: number; vx: number; vy: number;
  fuel: number;
  alive: boolean;
  arrived: boolean;
  /** how long it has been flying */
  flight: number;
  /** the path it has flown, for drawing */
  trail: Array<{ x: number; y: number }>;
}

export interface Mission {
  id: string;
  name: string;
  nameNl: string;
  /** which system, and which body you leave from and go to */
  system: 'sun' | 'earth';
  from: string;
  to: string;
  /** a second target after the first, for the grand tour */
  then?: string;
  /** total delta-v you can spend, in units of Earth's orbital speed */
  fuel: number;
  /** how much of the future the dotted line shows, in seconds of mission time */
  predict: number;
  /** may you nudge the probe mid-flight? */
  burns: number;
  /** how fast the clock runs: mission seconds per real second */
  speed: number;
  /** give up after this much mission time */
  limit: number;
  hint: string;
  hintNl: string;
}

export const MISSIONS: Mission[] = [
  { id: 'moon', name: 'To the Moon', nameNl: 'Naar de Maan', system: 'earth', from: 'earth', to: 'moon', fuel: 0.8, predict: 26, burns: 0, speed: 1.6, limit: 44,
    hint: 'Drag away from Earth to aim. The dotted line is where the probe will go. The ring is where the Moon will be when you get there.',
    hintNl: 'Sleep van de Aarde weg om te richten. De stippellijn is waar de sonde heen gaat. De ring is waar de Maan dan is.' },
  { id: 'mars', name: 'To Mars', nameNl: 'Naar Mars', system: 'sun', from: 'earth', to: 'mars', fuel: 0.5, predict: 16, burns: 0, speed: 1.4, limit: 60,
    hint: 'Push in the direction Earth is already moving. A little extra speed lifts you outward.',
    hintNl: 'Duw in de richting waarin de Aarde al beweegt. Een beetje extra snelheid tilt je naar buiten.' },
  { id: 'venus', name: 'To Venus', nameNl: 'Naar Venus', system: 'sun', from: 'earth', to: 'venus', fuel: 0.5, predict: 16, burns: 0, speed: 1.4, limit: 60,
    hint: 'Venus is closer to the sun. To fall inward you have to go slower than Earth: push backwards.',
    hintNl: 'Venus staat dichter bij de zon. Om naar binnen te vallen moet je langzamer dan de Aarde: duw naar achteren.' },
  { id: 'jupiter', name: 'To Jupiter', nameNl: 'Naar Jupiter', system: 'sun', from: 'earth', to: 'jupiter', fuel: 0.7, predict: 14, burns: 0, speed: 2.0, limit: 80,
    hint: 'A long way out. Jupiter moves slowly, so aim well ahead of where it is now.',
    hintNl: 'Een heel eind naar buiten. Jupiter beweegt traag, dus richt ver voor waar hij nu staat.' },
  { id: 'mercury', name: 'To Mercury', nameNl: 'Naar Mercurius', system: 'sun', from: 'earth', to: 'mercury', fuel: 0.8, predict: 12, burns: 0, speed: 1.4, limit: 60,
    hint: 'The hardest inward trip. You have to lose a lot of speed, and Mercury will not wait.',
    hintNl: 'De moeilijkste reis naar binnen. Je moet veel snelheid kwijt, en Mercurius wacht niet.' },
  { id: 'saturn', name: 'To Saturn', nameNl: 'Naar Saturnus', system: 'sun', from: 'earth', to: 'saturn', fuel: 0.8, predict: 10, burns: 1, speed: 2.4, limit: 100,
    hint: 'Too far to get right first time. Tap the probe in flight for one correction burn.',
    hintNl: 'Te ver om in een keer goed te doen. Tik onderweg op de sonde voor een correctie.' },
  { id: 'marsblind', name: 'Mars, by eye', nameNl: 'Mars, op het oog', system: 'sun', from: 'earth', to: 'mars', fuel: 0.55, predict: 5, burns: 1, speed: 1.4, limit: 60,
    hint: 'The line only shows the start now. You know how Mars moves. Lead it.',
    hintNl: 'De lijn toont nu alleen het begin. Je weet hoe Mars beweegt. Houd voor.' },
  { id: 'grandtour', name: 'The grand tour', nameNl: 'De grote reis', system: 'sun', from: 'earth', to: 'mars', then: 'jupiter', fuel: 1.1, predict: 8, burns: 2, speed: 2.0, limit: 140,
    hint: 'Mars first, refuel there, then on to Jupiter. Two launches, one story.',
    hintNl: 'Eerst Mars, daar bijtanken, dan door naar Jupiter. Twee lanceringen, een verhaal.' },
];

export const bodiesFor = (m: Mission): Body[] => (m.system === 'earth' ? MOON_SYSTEM : PLANETS);
export const bodyById = (m: Mission, id: string): Body => bodiesFor(m).find(b => b.id === id)!;

/** A probe sitting on `from` at time t, with a push of (dvx, dvy) added to the body's own motion. */
export function launch(m: Mission, fromId: string, t: number, dvx: number, dvy: number, fuel: number): Probe {
  const b = bodyById(m, fromId);
  let p = bodyPos(b, t), v = bodyVel(b, t);
  if (b.r === 0) {
    // leaving the body at the centre of the map: start in a low parking orbit round it, the way
    // every real mission does, rather than at the singular point in the middle of the well
    const r0 = b.size * 1.4;
    const w = Math.pow(r0, -1.5) * Math.sqrt(GM);
    const a = w * t;
    p = { x: Math.cos(a) * r0, y: Math.sin(a) * r0 };
    v = { x: -Math.sin(a) * w * r0, y: Math.cos(a) * w * r0 };
  }
  const cost = Math.hypot(dvx, dvy);
  return { x: p.x, y: p.y, vx: v.x + dvx, vy: v.y + dvy, fuel: Math.max(0, fuel - cost), alive: true, arrived: false, flight: 0, trail: [{ x: p.x, y: p.y }] };
}

/** Where a launch from `fromId` would start, for drawing the aiming arrow. */
export function launchPoint(m: Mission, fromId: string, t: number): { x: number; y: number } {
  return launch(m, fromId, t, 0, 0, 0);
}

/** Gravity from the central body only: a = -GM r / |r|^3. */
function accel(x: number, y: number): { ax: number; ay: number } {
  const d2 = x * x + y * y;
  const d = Math.sqrt(d2) || 1e-6;
  const k = -GM / (d2 * d);
  return { ax: x * k, ay: y * k };
}

/**
 * Advance a probe by dt of mission time. Semi-implicit Euler in small steps keeps the orbit closed
 * enough for a game, and it is cheap enough to run again every frame for the prediction.
 */
export function advance(p: Probe, dt: number, keepTrail: boolean): void {
  const steps = Math.max(1, Math.ceil(dt / 0.01));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    const a = accel(p.x, p.y);
    p.vx += a.ax * h; p.vy += a.ay * h;
    p.x += p.vx * h; p.y += p.vy * h;
  }
  p.flight += dt;
  if (keepTrail) {
    const last = p.trail[p.trail.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.02) p.trail.push({ x: p.x, y: p.y });
    if (p.trail.length > 600) p.trail.shift();
  }
}

export type Fate = 'flying' | 'arrived' | 'sun' | 'lost';

/** Has the probe reached the target, fallen into the sun, or drifted off the map? */
export function fate(m: Mission, p: Probe, targetId: string, t: number): Fate {
  const target = bodyById(m, targetId);
  const tp = bodyPos(target, t);
  if (Math.hypot(p.x - tp.x, p.y - tp.y) < target.capture) return 'arrived';
  const d = Math.hypot(p.x, p.y);
  const centre = bodiesFor(m).find(b => b.r === 0);
  if (m.system === 'earth' && centre && d < centre.size * 0.9) return 'sun';
  if (m.system === 'sun' && d < 0.12) return 'sun';
  const edge = m.system === 'earth' ? 2.4 : 5.6;
  if (d > edge) return 'lost';
  return 'flying';
}

export interface Prediction {
  points: Array<{ x: number; y: number }>;
  /** where the target will be at the moment of closest approach within the horizon */
  ghost: { x: number; y: number } | null;
  /** how close the probe gets, in map units */
  closest: number;
  /** when that happens, in mission seconds from now */
  when: number;
  /** does the predicted path actually arrive? */
  arrives: boolean;
}

/** Fly a copy of the probe forward and report what would happen. */
export function predict(m: Mission, p: Probe, targetId: string, t0: number, horizon: number): Prediction {
  const q: Probe = { ...p, trail: [] };
  const target = bodyById(m, targetId);
  const points: Array<{ x: number; y: number }> = [];
  let closest = Infinity, when = 0, ghost: { x: number; y: number } | null = null, arrives = false;
  const dt = 0.05;
  for (let t = 0; t < horizon; t += dt) {
    advance(q, dt, false);
    if (Math.round(t / dt) % 2 === 0) points.push({ x: q.x, y: q.y });
    const tp = bodyPos(target, t0 + t + dt);
    const d = Math.hypot(q.x - tp.x, q.y - tp.y);
    if (d < closest) { closest = d; when = t + dt; ghost = tp; }
    if (d < target.capture) { arrives = true; break; }
    const r = Math.hypot(q.x, q.y);
    if (r < 0.12 || r > 6) break;
  }
  return { points, ghost, closest, when, arrives };
}

/** Stars: arrived with fuel to spare, and without dawdling. */
export function starsFor(m: Mission, fuelLeft: number, flight: number): number {
  const f = fuelLeft / m.fuel;
  if (f > 0.35 && flight < m.limit * 0.5) return 3;
  if (f > 0.12 || flight < m.limit * 0.6) return 2;
  return 1;
}
