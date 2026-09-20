import { add, dist, fromAngle, mul, turnToward, type Vec } from '../util/math';
import { lang } from '../i18n';
import { AirportBuilder, buildAirport, freeGate, routeToGate, routeToRunway, type Airport } from './airport';
import { islandPolygon, pointInPoly, rectSamples } from './geo';
import { buildRealAirport } from './realports';
import { runwayAccepts } from './planes';
import type { Plane } from './types';
import type { World, Runway } from './world';

const TAXI_SPEED = 15;
const APRON_SPEED = 9;
const PUSH_SPEED = 5;
const NL = (): boolean => lang() === 'nl';

/** Build an airport complex next to every paved runway, on the side with the most land. */
export function initAirports(world: World): void {
  const paved = world.runways.filter(r => r.kind === 'long' || r.kind === 'short');
  // real-world layout: one airport serving every runway
  const port = world.level.port;
  if (port) {
    const ap = buildRealAirport(port, paved.map(r => ({ id: r.id, threshold: r.threshold, dir: r.dir, heading: r.heading, length: r.length, width: r.width })), world.W, world.H, world.fx.terminalTier);
    for (const r of paved) r.airport = ap;
    return;
  }
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
  if (world.level.port) return pts;
  const back = { x: -world.shift.x, y: -world.shift.y };
  for (const rw of world.runways) {
    if (rw.kind === 'water') continue;
    if (rw.kind === 'helipad') { pts.push(add(rw.threshold, back)); continue; }
    const perp = { x: -rw.dir.y, y: rw.dir.x };
    for (let a = -60; a <= rw.length + 60; a += 30) for (const s of [-1, 0, 1]) pts.push(add(add(add(rw.threshold, back), mul(rw.dir, a)), mul(perp, (rw.width / 2 + 40) * s)));
    if (rw.airport) pts.push(...rectSamples(rw.airport.footprint, 40).map(p => add(p, back)));
  }
  return pts;
}

/** Called when the roll-out is done: hand the aircraft to ground control. */
export function startArrivalTaxi(world: World, p: Plane, rw: Runway): void {
  const ap = rw.airport;
  if (!ap) { p.state = 'landed'; p.landingT = world.time; return; }
  const along = (p.pos.x - rw.threshold.x) * rw.dir.x + (p.pos.y - rw.threshold.y) * rw.dir.y;
  const gate = freeGate(ap, p.type.family === 'ga' || p.type.family === 'sea' ? 'ga' : p.type.cls === 'heavy' || p.type.cls === 'fast' ? 'heavy' : p.type.cls === 'light' ? 'light' : 'medium');
  const routeId = ap.exits[rw.id] ? rw.id : Object.keys(ap.exits)[0];
  const route = routeToGate(ap, routeId, along, gate ?? ap.gates[0]).points;
  if (gate) gate.occupiedBy = p.id; else route.length = Math.min(route.length, 3); // no stand free: vacate the runway and vanish to a remote stand
  p.state = 'taxi';
  p.gateId = gate ? gate.id : null;
  p.airportId = ap.id;
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
  const ap = world.airportById(p.airportId);
  // the runway this aircraft belongs to right now: the one it landed on, or the one it departs from
  const rw = world.runwayById(p.departRunway) ?? world.runwayById(p.landedOn) ?? world.runways.find(r => r.airport === ap);
  if (!rw || !ap) { p.state = 'landed'; p.landingT = world.time; return; }
  switch (p.state) {
    case 'taxi': {
      // still on the runway until the first waypoint on the taxiway is reached
      const offRw = p.ground!.seg >= 2;
      const own = world.runwayById(p.landedOn ?? p.airportId);
      if (own) { if (!p.outbound && !offRw && own.occupiedBy !== p.id) own.occupiedBy = p.id; if (!p.outbound && offRw && own.occupiedBy === p.id) own.occupiedBy = null; }
      // hold short of any runway the route crosses
      const nextPt = p.ground!.path[p.ground!.seg];
      if (nextPt) {
        const crossing = world.runways.find(r => r !== own && r.kind !== 'water' && r.kind !== 'helipad' && onRunwaySurface(r, nextPt) && dist(p.pos, nextPt) < 70);
        if (crossing && (crossing.occupiedBy !== null && crossing.occupiedBy !== p.id || world.planes.some(o => o.state === 'flying' && o.lockedRunway === crossing.id && dist(o.pos, crossing.threshold) < 420))) { p.speed = 0; return; }
      }
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
      const depRw = pickDepartureRunway(world, ap, p);
      const r = depRw ? routeToRunway(ap, gate, depRw) : null;
      if (!r) { p.parkUntil = world.time + 10; return; }
      p.departRunway = depRw!;
      p.state = 'pushback'; p.outbound = true;
      p.ground = { path: r.pushback, seg: 0, reverse: true };
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
      const dep = world.runwayById(p.departRunway ?? rw.id) ?? rw;
      const arrivalClose = world.planes.some(o => o.state === 'flying' && o.lockedRunway === dep.id && dist(o.pos, dep.threshold) < 360)
        || world.planes.some(o => o.state === 'landing' && o.runway === dep.id);
      if (dep.occupiedBy !== null || arrivalClose) return;
      dep.occupiedBy = p.id;
      p.state = 'takeoff'; p.takeoffAlong = 0; p.speed = 0;
      p.pos = { ...(ap.lineUp[dep.id] ?? ap.lineUp[rw.id]) }; p.heading = dep.heading;
      world.emit('takeoff', [p.id], `${p.type.name}: ${NL() ? 'vertrekt' : 'departing'}`, {});
      return;
    }
    case 'takeoff': {
      const dep = world.runwayById(p.departRunway ?? rw.id) ?? rw;
      const vr = p.type.speed * 0.95;
      const accel = p.type.family === 'fighter' ? 60 : p.type.cls === 'heavy' ? 22 : 34;
      p.speed = Math.min(vr * 1.05, p.speed + accel * dt);
      p.heading = turnToward(p.heading, dep.heading, 2 * dt);
      p.pos = add(p.pos, mul(dep.dir, p.speed * dt));
      p.takeoffAlong += p.speed * dt;
      const airborne = p.speed >= vr * 0.98;
      if (airborne) {
        p.altitude = Math.min(1, p.altitude + dt * 0.35);
        if (p.altitude > 0.3 && dep.occupiedBy === p.id) dep.occupiedBy = null;
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


/** True when p lies on the paved surface of a runway. */
export function onRunwaySurface(rw: Runway, p: Vec): boolean {
  const dx = p.x - rw.threshold.x, dy = p.y - rw.threshold.y;
  const along = dx * rw.dir.x + dy * rw.dir.y;
  const lat = Math.abs(-dx * rw.dir.y + dy * rw.dir.x);
  return along > -20 && along < rw.length + 20 && lat < rw.width * 0.6 + 8;
}

/** Choose a departure runway: one this type can use, preferring the least busy. */
function pickDepartureRunway(world: World, ap: Airport, p: Plane): string | null {
  const options = ap.departRunways.filter(id => {
    const r = world.runwayById(id);
    return r && runwayAccepts(r.kind, p.type) && ap.holds[id] !== undefined;
  });
  if (!options.length) return null;
  const score = (id: string): number => {
    const r = world.runwayById(id)!;
    let s = r.occupiedBy !== null ? 100 : 0;
    s += world.planes.filter(o => o.state === 'flying' && o.lockedRunway === id).length * 12;
    s += world.planes.filter(o => (o.state === 'holding' || o.state === 'takeoff') && o.departRunway === id).length * 25;
    return s;
  };
  return options.slice().sort((a, b) => score(a) - score(b))[0];
}

/** Extend an existing airport graph with a second, parallel runway: exits, hold point and line-up. */
export function addParallelRunway(ap: Airport, twin: Runway, main: Runway): void {
  const b = new AirportBuilder();
  b.nodes = ap.nodes; b.edges = ap.edges; b.nodeRunway = ap.nodeRunway;
  for (const n of ap.nodes) b.node(n); // re-register keys
  const perp = { x: -twin.dir.y, y: twin.dir.x };
  const toMain = Math.sign((main.threshold.x - twin.threshold.x) * perp.x + (main.threshold.y - twin.threshold.y) * perp.y) || 1;
  const W = (along: number, across: number): Vec => add(add(twin.threshold, mul(twin.dir, along)), mul(perp, across * toMain));
  // a link taxiway between the two runways, at the same exit positions as the main runway
  const exits: Array<{ along: number; on: number; off: number }> = [];
  for (const e of ap.exits[main.id] ?? []) {
    const on = b.node(W(e.along, 0), twin.id);
    const mid = b.node(W(e.along, (main.width + 150) / 2 - main.width / 2 - 20));
    b.link(on, mid, 'taxi');
    b.link(mid, e.on, 'taxi');
    exits.push({ along: e.along, on, off: mid });
  }
  // holding point for departures, connected to the main taxiway network via the first link
  const holdPos = W(-46, 44);
  const hold = b.node(holdPos);
  const firstMid = exits[0]?.off;
  if (firstMid !== undefined) b.link(hold, firstMid, 'taxi');
  b.link(hold, b.node(W(8, 0), twin.id), 'taxi');
  ap.nodes = b.nodes; ap.edges = b.edges; ap.nodeRunway = b.nodeRunway; ap.adj = b.adjacency();
  ap.exits[twin.id] = exits;
  ap.holds[twin.id] = hold;
  ap.lineUp[twin.id] = W(8, 0);
  ap.departRunways.push(twin.id);
}
