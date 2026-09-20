/**
 * Moonshot: build a rocket out of parts, then fly the thing you built.
 *
 * The whole game is one comparison a five-year-old can make: is the push bigger than the weight?
 * Everything you bolt on makes the rocket heavier, so an engine that lifts one tank will not lift
 * three, and a rocket that cannot lift itself sits on the pad and shakes. That is the lesson, and
 * it is the same lesson rocket engineers have.
 *
 * Underneath it is honest. Mass falls as fuel burns, so a rocket gets livelier as it empties;
 * gravity weakens with height by the inverse square; the air thins out and stops pushing back;
 * and a stage that has run dry is dead weight until you drop it. Exhaust speed is a real 3 km/s,
 * so the rocket equation is doing the work even though nobody says its name. The one thing bent
 * for a child is the clock: tanks empty in seconds rather than minutes, because nobody that age
 * is going to watch an eight-minute ascent.
 */

// ---------------------------------------------------------------- the parts

export type PartKind = 'capsule' | 'tank' | 'engine' | 'booster' | 'fin';

export interface Part {
  id: string;
  kind: PartKind;
  name: string;
  nameNl: string;
  /** empty mass, in tonnes */
  dry: number;
  /** fuel carried, in tonnes */
  fuel: number;
  /** tonnes of fuel burnt per second at full throttle */
  burn: number;
  /** how fast the exhaust leaves, in metres per second: the quality of the engine */
  exhaust: number;
  /** how wide and tall it is drawn, in rocket units */
  w: number;
  h: number;
  /** how many stars you need before it is yours */
  unlockAt: number;
}

const P = (p: Partial<Part> & { id: string; kind: PartKind; name: string; nameNl: string }): Part => ({
  dry: 0, fuel: 0, burn: 0, exhaust: 3000, w: 1, h: 1, unlockAt: 0, ...p,
});

/**
 * Nine parts, and every one of them a trade.
 *
 * The engines are the interesting ones, because they differ in two ways at once. The small engine
 * is cheap and weak. The big one pushes three times harder and weighs nearly three times as much.
 * The cluster is brute force off the pad. And the last two are the ones that actually get you
 * anywhere: the vacuum engine and the nuclear engine push gently but throw their exhaust out far
 * faster, and exhaust speed is what decides how far a rocket ends up going. A child does not need
 * that sentence - they need to notice that the quiet engine on top beat the loud one.
 *
 * The nuclear engine is not invented. NASA built and fired one in the sixties, and its exhaust
 * really was about twice as fast as the best chemical engine.
 */
export const PARTS: Part[] = [
  P({ id: 'capsule', kind: 'capsule', name: 'Capsule', nameNl: 'Capsule', dry: 0.8, w: 0.74, h: 1.5 }),
  P({ id: 'tank-s', kind: 'tank', name: 'Small tank', nameNl: 'Kleine tank', dry: 0.2, fuel: 4.5, w: 1, h: 1.7 }),
  P({ id: 'engine-s', kind: 'engine', name: 'Small engine', nameNl: 'Kleine motor', dry: 0.5, burn: 0.17, exhaust: 2600, w: 1, h: 0.95 }),
  P({ id: 'fin', kind: 'fin', name: 'Fins', nameNl: 'Vinnen', dry: 0.3, w: 1.9, h: 1.0, unlockAt: 1 }),
  P({ id: 'tank-l', kind: 'tank', name: 'Big tank', nameNl: 'Grote tank', dry: 0.45, fuel: 11, w: 1, h: 3.6, unlockAt: 2 }),
  P({ id: 'engine-l', kind: 'engine', name: 'Big engine', nameNl: 'Grote motor', dry: 1.3, burn: 0.55, exhaust: 3050, w: 1.08, h: 1.15, unlockAt: 3 }),
  P({ id: 'booster', kind: 'booster', name: 'Boosters', nameNl: 'Boosters', dry: 0.6, fuel: 6, burn: 0.7, exhaust: 2700, w: 0.52, h: 3.4, unlockAt: 4 }),
  P({ id: 'engine-x', kind: 'engine', name: 'Three engines', nameNl: 'Drie motoren', dry: 2.8, burn: 1.55, exhaust: 2950, w: 1.32, h: 1.3, unlockAt: 5 }),
  P({ id: 'engine-v', kind: 'engine', name: 'Vacuum engine', nameNl: 'Vacuummotor', dry: 0.5, burn: 0.17, exhaust: 4000, w: 1.02, h: 1.25, unlockAt: 6 }),
  P({ id: 'engine-n', kind: 'engine', name: 'Nuclear engine', nameNl: 'Kernmotor', dry: 1.2, burn: 0.14, exhaust: 8000, w: 1.05, h: 1.5, unlockAt: 7 }),
];

/** A stack taller than this is more rocket than a phone screen can show. */
export const MAX_PARTS = 14;

export const partById = (id: string): Part => PARTS.find(p => p.id === id)!;

// ---------------------------------------------------------------- what you built

/** The stack, bottom part first. The capsule always sits on top and is not in this list. */
export type Stack = string[];

export interface Stage {
  /** index into the stack of the engine that drives this stage */
  engine: number;
  /** the tanks it feeds, which are the ones sitting directly above it */
  tanks: number[];
  /** everything that drops away with it */
  parts: number[];
  thrust: number;
  fuel: number;
  burn: number;
}

/**
 * Cut the stack into stages.
 *
 * Reading from the bottom, an engine owns every tank above it until the next engine. That is how
 * a child stacks the parts without being told anything, and it happens to be how a real rocket is
 * put together, so the picture and the physics agree.
 */
export function stagesOf(stack: Stack): Stage[] {
  const out: Stage[] = [];
  let current: Stage | null = null;
  const boosters: number[] = [];
  stack.forEach((id, i) => {
    const p = partById(id);
    if (p.kind === 'engine') {
      current = { engine: i, tanks: [], parts: [i], thrust: p.burn * p.exhaust, fuel: 0, burn: p.burn };
      out.push(current);
      return;
    }
    if (p.kind === 'booster') { boosters.push(i); return; }
    if (!current) return;
    current.parts.push(i);
    if (p.kind === 'tank') { current.tanks.push(i); current.fuel += p.fuel; }
  });
  // boosters strap to the bottom stage and burn alongside it
  if (out.length && boosters.length) {
    const b = partById('booster');
    const first = out[0];
    for (const i of boosters) {
      first.parts.push(i);
      first.thrust += b.burn * b.exhaust;
      first.fuel += b.fuel;
      first.burn += b.burn;
    }
  }
  return out;
}

/** Everything on the pad, fuel and all, in tonnes. */
export function totalMass(stack: Stack): number {
  return partById('capsule').dry + stack.reduce((m, id) => {
    const p = partById(id);
    return m + p.dry + p.fuel;
  }, 0);
}

/** What the bottom stage can push with, in kilonewtons. */
export function liftThrust(stack: Stack): number {
  const st = stagesOf(stack);
  return st.length ? st[0].thrust : 0;
}

export const G0 = 9.81;

/** Weight on the pad, in kilonewtons: what the push has to beat. */
export const padWeight = (stack: Stack): number => totalMass(stack) * G0;

/** Will it leave the ground at all? This is the question the whole build screen asks. */
export const canLift = (stack: Stack): boolean => liftThrust(stack) > padWeight(stack) * 1.02;

/** A rocket has to have something to burn and something to burn it with. */
export const isFlyable = (stack: Stack): boolean => {
  const st = stagesOf(stack);
  return st.length > 0 && st[0].fuel > 0 && canLift(stack);
};

// ---------------------------------------------------------------- how far it got

export interface Milestone {
  /** how fast you must be going when the fuel runs out, in metres per second */
  speed: number;
  /** the height it works out to, for the readout, in kilometres */
  km: number;
  name: string;
  nameNl: string;
  /** stars this is worth */
  stars: number;
}

/**
 * The ladder. The speeds are what you actually need: a hundred kilometres up is a mile a second,
 * and the Moon is very nearly escape velocity, which is why it is the last thing you reach before
 * you are simply gone. Nothing here is rounded for effect.
 */
export const LADDER: Milestone[] = [
  { speed: 0, km: 0, name: 'The pad', nameNl: 'Het platform', stars: 0 },
  { speed: 140, km: 1, name: 'Up with the birds', nameNl: 'Bij de vogels', stars: 1 },
  { speed: 340, km: 6, name: 'Through the clouds', nameNl: 'Door de wolken', stars: 1 },
  { speed: 620, km: 20, name: 'Above the aeroplanes', nameNl: 'Boven de vliegtuigen', stars: 2 },
  { speed: 1390, km: 100, name: 'The edge of the air', nameNl: 'De rand van de lucht', stars: 2 },
  { speed: 2720, km: 400, name: 'Round the Earth', nameNl: 'Een rondje om de Aarde', stars: 3 },
  { speed: 6800, km: 8000, name: 'Past the satellites', nameNl: 'Voorbij de satellieten', stars: 3 },
  { speed: 10874, km: 384400, name: 'As far as the Moon', nameNl: 'Zo ver als de Maan', stars: 4 },
  { speed: 11200, km: 3.4e6, name: 'Away from the Earth', nameNl: 'Los van de Aarde', stars: 4 },
  { speed: 13000, km: 7.8e7, name: 'As far as Mars', nameNl: 'Zo ver als Mars', stars: 5 },
  { speed: 16600, km: 6.3e8, name: 'As far as Jupiter', nameNl: 'Zo ver als Jupiter', stars: 5 },
  { speed: 20000, km: 5e9, name: 'Out past the planets', nameNl: 'Voorbij de planeten', stars: 5 },
];

/** Which rung a burnout speed reaches, and how far up the ladder that is. */
export function rungFor(speed: number): { rung: Milestone; index: number } {
  let index = 0;
  for (let i = 0; i < LADDER.length; i++) if (speed >= LADDER[i].speed) index = i;
  return { rung: LADDER[index], index };
}

export const EARTH_R = 6371e3;

/**
 * How high a rocket coasts on the speed it has left.
 *
 * Straight up with no air left, all the speed turns into height against a gravity that weakens as
 * you climb. Past escape speed the sum has no answer, which is the honest way of saying you are
 * not coming back.
 */
export function coastHeight(speedUp: number, fromKm: number): number {
  const r0 = EARTH_R + fromKm * 1000;
  const esc = Math.sqrt(2 * G0 * EARTH_R * EARTH_R / r0);
  if (speedUp >= esc) return Infinity;
  const r = 1 / (1 / r0 - speedUp * speedUp / (2 * G0 * EARTH_R * EARTH_R));
  return (r - EARTH_R) / 1000;
}

/** The next rung up from the one you are on, for the line that says what to aim at. */
export const nextRung = (index: number): Milestone | null => LADDER[index + 1] ?? null;

/** A height as a child would say it. */
export function kmLabel(km: number, nl: boolean): string {
  if (!isFinite(km)) return nl ? 'verder dan we kunnen tellen' : 'further than we can count';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 1000) return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  if (km < 1e6) return `${Math.round(km / 1000)}.000 km`;
  const mln = km / 1e6;
  return `${mln < 10 ? mln.toFixed(1) : Math.round(mln)} ${nl ? 'miljoen km' : 'million km'}`;
}

// ---------------------------------------------------------------- the air

/** How thick the air is at a height, as a fraction of sea level. Gone by about a hundred km. */
export const airAt = (altM: number): number => Math.exp(-Math.max(0, altM) / 8500);

/** Gravity at a height, weaker as you climb. */
export const gravityAt = (altM: number): number =>
  G0 * Math.pow(EARTH_R / (EARTH_R + Math.max(0, altM)), 2);
