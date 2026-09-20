import { add, dist, fromAngle, mul, turnToward, type Vec } from '../util/math';
import { lang } from '../i18n';
import { arrivalRoute, buildAirport, departureRoute, freeGate, toWorld, type Airport } from './airport';
import { islandPolygon, pointInPoly, rectSamples } from './geo';
import type { Plane } from './types';
import type { World, Runway } from './world';

const TAXI_SPEED = 15;
const APRON_SPEED = 9;
const PUSH_SPEED = 5;
const NL = (): boolean => lang() === 'nl';

/** Build an airport complex next to every paved runway, on the side with the most land. */
export function initAirports(world: World): void {
  const paved = world.runways.filter(r => r.kind === 'long' || r.kind === 'short');
  // rough island shapes without airports, just to pick a side
  const rough = world.level.islands.map(def => islandPolygon(def, world.W, world.H, paved.flatMap(rw => [rw.threshold, rw.center, rw.end])));
  for (const rw of paved) {
    const probe = (side: 1 | -1, d: number): boolean => {
      const n = { x: -rw.dir.y * side, y: rw.dir.x * side };
      const p = add(rw.center, mul(n, d));
      return rough.some(i => pointInPoly(p, i.poly));
    };
    // prefer the side with land under the complex and the most room to the map edge
    const margin = (side: 1 | -1): number => {
      const n = { x: -rw.dir.y * side, y: rw.dir.x * side };
      const p = add(rw.center, mul(n, 330));
      return Math.min(p.x, world.W - p.x, p.y, world.H - p.y);
    };
    const land = (side: 1 | -1): number => (probe(side, 120) ? 1 : 0) + (probe(side, 220) ? 1 : 0) + (probe(side, 320) ? 1 : 0);
    const val = (side: 1 | -1): number => land(side) * 1000 + margin(side);
    const side: 1 | -1 = val(1) >= val(-1) ? 1 : -1;
    rw.airport = buildAirport(rw.id, rw.threshold, rw.dir, rw.heading, rw.length, rw.width, side, world.fx.terminalTier, rw.kind === 'short');
  }
}

/** Points that every island polygon must contain (used by the terrain painter). */
export function mustContainPoints(world: World): Vec[] {
  const pts: Vec[] = [];
  for (const rw of world.runways) {
    if (rw.kind === 'water') continue;
    if (rw.kind === 'helipad') { pts.push(rw.threshold); continue; }
    const perp = { x: -rw.dir.y, y: rw.dir.x };
    for (let a = -60; a <= rw.length + 60; a += 30) for (const s of [-1, 0, 1]) pts.push(add(add(rw.threshold, mul(rw.dir, a)), mul(perp, (rw.width / 2 + 40) * s)));
    if (rw.airport) pts.push(...rectSamples(rw.airport.footprint, 40));
  }
  return pts;
}

/** Called when the roll-out is done: hand the aircraft to ground control. */
export function startArrivalTaxi(world: World, p: Plane, rw: Runway): void {
  const ap = rw.airport;
  if (!ap) { p.state = 'landed'; p.landingT = world.time; return; }
  const along = (p.pos.x - rw.threshold.x) * rw.dir.x + (p.pos.y - rw.threshold.y) * rw.dir.y;
  const gate = freeGate(ap, p.type.family === 'ga' || p.type.family === 'sea' ? 'ga' : p.type.cls === 'heavy' || p.type.cls === 'fast' ? 'heavy' : p.type.cls === 'light' ? 'light' : 'medium');
  const fromY = rw.parallelOf ? (rw.threshold.x - ap.origin.x) * ap.uy.x + (rw.threshold.y - ap.origin.y) * ap.uy.y : 0;
  const route = arrivalRoute(ap, along, gate ?? ap.gates[0], fromY);
  if (gate) gate.occupiedBy = p.id; else route.length = fromY !== 0 ? 3 : 2; // no stand free: vacate the runway and disappear to a remote stand
  p.state = 'taxi';
  p.gateId = gate ? gate.id : null;
  p.airportId = ap.runwayId;
  p.landedOn = rw.id;
  p.outbound = false;
  p.ground = { path: route, seg: 0, reverse: false };
  p.altitude = 0; p.bank = 0; p.speed = TAXI_SPEED;
  world.emit('taxi', [p.id], `${p.type.name}: ${NL() ? 'taxiet naar' : 'taxiing to'} ${gate ? (gate.cls === 'ga' ? (NL() ? 'het GA-platform' : 'the GA apron') : `gate ${gate.id}`) : (NL() ? 'een remote stand' : 'a remote stand')}`, { gate: gate?.id ?? -1 });
}

function followGround(p: Plane, dt: number, speed: number): boolean {
  const g = p.ground!;
  let remaining = speed * dt;
  while (remaining > 0 && g.seg < g.path.length) {
    const target = g.path[g.seg];
    const d = dist(p.pos, target);
    if (d <= remaining) { p.pos = { ...target }; remaining -= d; g.seg++; continue; }
    const dir = Math.atan2(target.y - p.pos.y, target.x - p.pos.x);
    const face = g.reverse ? dir + Math.PI : dir;
    p.heading = turnToward(p.heading, face, 2.6 * dt + 0.02 * Math.min(1, remaining / 4));
    p.pos = add(p.pos, mul(fromAngle(dir, remaining), 1));
    remaining = 0;
  }
  return g.seg >= g.path.length;
}

export function updateGround(world: World, p: Plane, dt: number): void {
  const rw = world.runwayById(p.airportId);
  const ap = rw?.airport;
  if (!rw || !ap) { p.state = 'landed'; p.landingT = world.time; return; }
  switch (p.state) {
    case 'taxi': {
      // still on the runway until the first waypoint on the taxiway is reached
      const offRw = p.ground!.seg >= (p.ground!.path.length >= 3 && world.runwayById(p.landedOn ?? '')?.parallelOf ? 3 : 2);
      const own = world.runwayById(p.landedOn ?? p.airportId);
      if (own) { if (!p.outbound && !offRw && own.occupiedBy !== p.id) own.occupiedBy = p.id; if (!p.outbound && offRw && own.occupiedBy === p.id) own.occupiedBy = null; }
      // keep a gap behind other ground traffic
      const ahead = world.planes.some(o => o !== p && o.ground && (o.state === 'taxi' || o.state === 'pushback' || o.state === 'holding') && dist(o.pos, p.pos) < 46 && Math.cos(Math.atan2(o.pos.y - p.pos.y, o.pos.x - p.pos.x) - p.heading) > 0.5);
      if (ahead) { p.speed = 0; return; }
      const g = p.ground!;
      const nearEnd = g.seg >= g.path.length - 2;
      p.speed = nearEnd ? APRON_SPEED : TAXI_SPEED;
      const done = followGround(p, dt, p.speed);
      if (!done) return;
      if (p.outbound) { p.state = 'holding'; p.speed = 0; return; }
      if (p.gateId === null) { p.state = 'landed'; p.landingT = world.time; return; } // remote stand: vanish
      const gate = ap.gates.find(x => x.id === p.gateId)!;
      p.heading = gate.heading; p.pos = { ...gate.pos };
      p.state = 'parked'; p.speed = 0;
      p.parkUntil = world.time + 24 + Math.random() * 26;
      return;
    }
    case 'parked': {
      if (world.time < p.parkUntil) return;
      // one departure at a time per airport, and never while an arrival is on short final
      const busyOut = world.planes.some(o => o !== p && o.airportId === p.airportId && (o.state === 'pushback' || (o.state === 'taxi' && o.outbound) || o.state === 'holding' || o.state === 'takeoff'));
      if (busyOut) { p.parkUntil = world.time + 3; return; }
      const gate = ap.gates.find(x => x.id === p.gateId)!;
      const r = departureRoute(ap, gate);
      p.state = 'pushback'; p.outbound = true;
      p.ground = { path: r.pushback.slice(1), seg: 0, reverse: true };
      (p as unknown as { taxiOut: Vec[] }).taxiOut = r.taxi;
      world.emit('pushback', [p.id], `${p.type.name}: pushback`, {});
      return;
    }
    case 'pushback': {
      const done = followGround(p, dt, PUSH_SPEED);
      if (!done) return;
      const gate = ap.gates.find(x => x.id === p.gateId);
      if (gate) gate.occupiedBy = null;
      p.gateId = null;
      p.state = 'taxi';
      p.ground = { path: (p as unknown as { taxiOut: Vec[] }).taxiOut, seg: 0, reverse: false };
      return;
    }
    case 'holding': {
      // wait for a free runway with no arrival on short final
      const arrivalClose = world.planes.some(o => o.state === 'flying' && o.lockedRunway === rw.id && dist(o.pos, rw.threshold) < 360)
        || world.planes.some(o => o.state === 'landing' && o.runway === rw.id);
      if (rw.occupiedBy !== null || arrivalClose) return;
      rw.occupiedBy = p.id;
      p.state = 'takeoff'; p.takeoffAlong = 0; p.speed = 0;
      p.pos = toWorld(ap, 8, 0); p.heading = rw.heading;
      world.emit('takeoff', [p.id], `${p.type.name}: ${NL() ? 'vertrekt' : 'departing'}`, {});
      return;
    }
    case 'takeoff': {
      const vr = p.type.speed * 0.95;
      const accel = p.type.family === 'fighter' ? 60 : p.type.cls === 'heavy' ? 22 : 34;
      p.speed = Math.min(vr * 1.05, p.speed + accel * dt);
      p.heading = turnToward(p.heading, rw.heading, 2 * dt);
      p.pos = add(p.pos, mul(rw.dir, p.speed * dt));
      p.takeoffAlong += p.speed * dt;
      const airborne = p.speed >= vr * 0.98;
      if (airborne) {
        p.altitude = Math.min(1, p.altitude + dt * 0.35);
        if (p.altitude > 0.3 && rw.occupiedBy === p.id) rw.occupiedBy = null;
        if (p.altitude >= 0.99) { p.state = 'departing'; p.speed = p.type.speed; }
      }
      return;
    }
    case 'departing': {
      p.speed = p.type.speed;
      p.pos = add(p.pos, mul(fromAngle(p.heading, p.speed), dt));
      const m = 120;
      if (p.pos.x < -m || p.pos.x > world.W + m || p.pos.y < -m || p.pos.y > world.H + m) { p.state = 'landed'; p.landingT = world.time; }
      return;
    }
  }
}

export const isGroundState = (s: Plane['state']): boolean => s === 'taxi' || s === 'parked' || s === 'pushback' || s === 'holding' || s === 'takeoff';
export type { Airport };
