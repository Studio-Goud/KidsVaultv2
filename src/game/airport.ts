import { add, mul, type Vec } from '../util/math';
import type { Rect } from './geo';

/**
 * Airport layout in runway-local coordinates: x runs along the landing direction from the threshold
 * (0 .. L), y runs across the runway towards the terminal side. Everything is converted to world
 * coordinates once, so the simulation and the painter share the exact same geometry.
 */

export type GateClass = 'ga' | 'gate' | 'heavy';

export interface Gate { id: number; pos: Vec; heading: number; cls: GateClass; occupiedBy: number | null; local: Vec }
export interface Building { kind: 'terminal' | 'pier' | 'hangar' | 'fuel' | 'fire' | 'tower' | 'carpark' | 'cargo'; rect: Rect; local: { x: number; y: number; w: number; h: number } }

export interface Airport {
  runwayId: string;
  side: 1 | -1;
  origin: Vec;        // threshold
  ux: Vec;            // unit along runway
  uy: Vec;            // unit towards terminal side
  L: number;
  w: number;
  taxiwayY: number;   // local y of the parallel taxiway centreline
  apronLaneY: number; // local y of the apron taxi lane
  apron: { x0: number; x1: number; y0: number; y1: number };
  gaApron: { x0: number; x1: number; y0: number; y1: number };
  terminalY: number;  // local y of the terminal face (apron side)
  exits: number[];    // local x positions of runway exits onto the taxiway
  holdX: number;      // local x of the holding point before the threshold
  connectors: number[]; // local x where the taxiway joins the apron lane
  gates: Gate[];
  buildings: Building[];
  vehicles: Array<{ path: Vec[]; speed: number; phase: number; kind: 'tug' | 'fuel' | 'bus' }>;
  footprint: Rect;    // for the island shape
  roadAnchor: Vec;    // where the access road leaves the airport
}

export const toWorld = (ap: Airport, x: number, y: number): Vec => add(ap.origin, add(mul(ap.ux, x), mul(ap.uy, y)));

export function buildAirport(runwayId: string, threshold: Vec, dir: Vec, heading: number, L: number, w: number, side: 1 | -1, tier = 0, compact = false): Airport {
  const ux = dir;
  const uy = { x: -dir.y * side, y: dir.x * side };
  // a regional strip gets a compact complex: taxiway closer in, one apron row, fewer stands
  const k = compact ? 0.62 : 1;
  const ap: Airport = {
    runwayId, side, origin: threshold, ux, uy, L, w,
    taxiwayY: w / 2 + 62 * k,
    apronLaneY: w / 2 + 62 * k + 96 * k,
    apron: { x0: L * 0.04, x1: L * 0.96, y0: w / 2 + (62 + 22) * k, y1: w / 2 + (62 + 22 + 165) * k },
    gaApron: { x0: L * 0.96 + 16, x1: L + 96 * k, y0: w / 2 + (62 + 22) * k, y1: w / 2 + (62 + 22 + 120) * k },
    terminalY: w / 2 + (62 + 22 + 165) * k,
    exits: [L * 0.52, L * 0.7, L * 0.88],
    holdX: -46,
    connectors: [L * 0.1, L * 0.5, L * 0.9],
    gates: [], buildings: [], vehicles: [],
    footprint: { x: 0, y: 0, w: 0, h: 0, rot: 0 },
    roadAnchor: { x: 0, y: 0 },
  };
  const W = (x: number, y: number): Vec => toWorld(ap, x, y);

  // gates along the terminal face, nose-in
  const gateCount = (compact ? 4 : 6) + Math.min(2, tier);
  const span = L * 0.84;
  const gx0 = L * 0.08;
  const step = span / (gateCount - 1);
  for (let i = 0; i < gateCount; i++) {
    const x = gx0 + i * step;
    const cls: GateClass = i === 0 || i === gateCount - 1 ? 'heavy' : 'gate';
    const local = { x, y: ap.terminalY - 62 };
    ap.gates.push({ id: i + 1, pos: W(local.x, local.y), heading: Math.atan2(uy.y, uy.x), cls, occupiedBy: null, local });
  }
  // GA tie-downs: two rows of three, nose along the runway direction
  const gaRows = compact ? 1 : 2, gaCols = 3;
  for (let r = 0; r < gaRows; r++) for (let c = 0; c < gaCols; c++) {
    const local = { x: ap.gaApron.x0 + 22 + c * 28, y: ap.gaApron.y0 + 30 + r * 50 };
    ap.gates.push({ id: 100 + r * gaCols + c, pos: W(local.x, local.y), heading, cls: 'ga', occupiedBy: null, local });
  }

  // buildings (local rects, centre + size)
  const B = (kind: Building['kind'], x: number, y: number, bw: number, bh: number): void => {
    ap.buildings.push({ kind, local: { x, y, w: bw, h: bh }, rect: { ...W(x, y), w: bw, h: bh, rot: heading } });
  };
  B('terminal', L * 0.5, ap.terminalY + 26, span + 40, 52);
  if (!compact) B('pier', L * 0.5, ap.terminalY + 52 + 40, 70, 80);
  B('tower', L * 0.62, ap.terminalY + 52 + (compact ? 22 : 46), 22, 22);
  B('carpark', L * 0.28, ap.terminalY + 52 + (compact ? 26 : 48), compact ? 110 : 150, compact ? 44 : 70);
  B('hangar', L * 0.1, ap.terminalY - 20 - 120 - 36, 64, 44);
  if (tier >= 1) B('hangar', L * 0.02, ap.terminalY - 20 - 120 - 36, 64, 44);
  B('cargo', L * 0.96 + 56, ap.terminalY + 26, 80, 44);
  B('fuel', L * 0.96 + 60, ap.terminalY - 70, 44, 40);
  B('fire', L * 0.5, -(w / 2 + 44), 46, 26);
  ap.roadAnchor = W(L * 0.28, ap.terminalY + 52 + (compact ? 26 : 48) + (compact ? 24 : 40));

  // ground vehicles looping on the apron lane and around the piers
  const lane = [W(ap.apron.x0 + 10, ap.apronLaneY + 34), W(ap.apron.x1 - 10, ap.apronLaneY + 34), W(ap.apron.x1 - 10, ap.terminalY - 16), W(ap.apron.x0 + 10, ap.terminalY - 16)];
  ap.vehicles.push({ path: lane, speed: 11, phase: 0, kind: 'tug' }, { path: lane.slice().reverse(), speed: 9, phase: 0.45, kind: 'bus' }, { path: lane, speed: 7, phase: 0.7, kind: 'fuel' });

  // footprint for the island shape: everything from the far side of the runway to behind the car park
  const y0 = -(w / 2 + 70), y1 = ap.terminalY + 52 + (compact ? 26 : 48) + (compact ? 34 : 60);
  const x0 = -80, x1 = L + 110;
  const c = W((x0 + x1) / 2, (y0 + y1) / 2);
  ap.footprint = { x: c.x, y: c.y, w: x1 - x0, h: y1 - y0, rot: heading };
  return ap;
}

// ---------- taxi routing ----------

/** Runway → first exit ahead → taxiway → connector → apron lane → gate. */
export function arrivalRoute(ap: Airport, alongNow: number, gate: Gate, fromY = 0): Vec[] {
  const W = (x: number, y: number): Vec => toWorld(ap, x, y);
  const exit = ap.exits.find(e => e > alongNow + 30) ?? ap.L - 12;
  // a parallel runway on the far side crosses the main runway on its way to the taxiway
  const pts: Vec[] = fromY !== 0 ? [W(exit, fromY), W(exit, 0), W(exit, ap.taxiwayY)] : [W(exit, 0), W(exit, ap.taxiwayY)];
  if (gate.cls === 'ga') {
    const gx = ap.gaApron.x0 + 10;
    pts.push(W(Math.max(exit, gx - 40), ap.taxiwayY), W(gx, ap.taxiwayY), W(gx, ap.gaApron.y0 + 20), W(gate.local.x - 14, gate.local.y), gate.pos);
    return pts;
  }
  // nearest connector at or beyond the exit direction of travel (taxiway runs both ways; pick the closest)
  const conn = ap.connectors.reduce((b, c) => (Math.abs(c - exit) < Math.abs(b - exit) ? c : b), ap.connectors[0]);
  pts.push(W(conn, ap.taxiwayY), W(conn, ap.apronLaneY), W(gate.local.x, ap.apronLaneY), gate.pos);
  return pts;
}

/** Gate → pushback onto the lane → taxiway → holding point → line up on the threshold. */
export function departureRoute(ap: Airport, gate: Gate): { pushback: Vec[]; taxi: Vec[] } {
  const W = (x: number, y: number): Vec => toWorld(ap, x, y);
  if (gate.cls === 'ga') {
    const gx = ap.gaApron.x0 + 10;
    return {
      pushback: [gate.pos, W(gate.local.x - 14, gate.local.y)],
      taxi: [W(gx, ap.gaApron.y0 + 20), W(gx, ap.taxiwayY), W(ap.holdX, ap.taxiwayY), W(ap.holdX, ap.taxiwayY * 0.5), W(8, 0)],
    };
  }
  const conn = ap.connectors[0];
  return {
    pushback: [gate.pos, W(gate.local.x, ap.apronLaneY)],
    taxi: [W(conn, ap.apronLaneY), W(conn, ap.taxiwayY), W(ap.holdX, ap.taxiwayY), W(ap.holdX, ap.taxiwayY * 0.5), W(8, 0)],
  };
}

export function freeGate(ap: Airport, cls: 'ga' | 'light' | 'medium' | 'heavy' | 'fast'): Gate | null {
  const want: GateClass[] = cls === 'ga' || cls === 'light' ? ['ga', 'gate', 'heavy'] : cls === 'heavy' ? ['heavy', 'gate'] : ['gate', 'heavy'];
  for (const k of want) { const g = ap.gates.find(x => x.cls === k && x.occupiedBy === null); if (g) return g; }
  return null;
}
