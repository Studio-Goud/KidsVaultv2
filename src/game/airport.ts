import { add, dist, mul, type Vec } from '../util/math';
import type { Rect } from './geo';

/**
 * An airport is a taxi network (nodes + edges) with stands, buildings and aprons, all in world
 * coordinates. Both the procedural island airports and the hand-built real-world layouts produce
 * this same structure, so routing and painting work the same everywhere.
 */

export type GateClass = 'ga' | 'gate' | 'heavy';
export type BuildingKind = 'terminal' | 'pier' | 'hangar' | 'fuel' | 'fire' | 'tower' | 'carpark' | 'cargo' | 'satellite';
export type EdgeClass = 'taxi' | 'apron' | 'lane';
export type ApronKind = 'stand' | 'ga' | 'cargo';

export interface Gate { id: number; label: string; pos: Vec; heading: number; cls: GateClass; occupiedBy: number | null; node: number; bridge: boolean }
export interface Building { kind: BuildingKind; pos: Vec; w: number; h: number; rot: number }
export interface TaxiEdge { a: number; b: number; cls: EdgeClass }
export interface ApronArea { poly: Vec[]; kind: ApronKind }

export interface Airport {
  id: string;
  nodes: Vec[];
  edges: TaxiEdge[];
  adj: number[][];
  /** node index -> runway id when the node sits on a runway surface */
  nodeRunway: Record<number, string>;
  gates: Gate[];
  buildings: Building[];
  aprons: ApronArea[];
  vehicles: Array<{ path: Vec[]; speed: number; phase: number; kind: 'tug' | 'fuel' | 'bus' }>;
  /** per runway: exit points along the runway, sorted by distance from the threshold */
  exits: Record<string, Array<{ along: number; on: number; off: number }>>;
  /** per runway: node at the holding point and the world position to line up on */
  holds: Record<string, number>;
  lineUp: Record<string, Vec>;
  departRunways: string[];
  footprint: Rect;
  roadAnchor: Vec;
  compact: boolean;
}

// ---------- builder ----------

export class AirportBuilder {
  nodes: Vec[] = [];
  edges: TaxiEdge[] = [];
  nodeRunway: Record<number, string> = {};
  private keyed = new Map<string, number>();

  node(p: Vec, runway?: string): number {
    const k = `${Math.round(p.x)}:${Math.round(p.y)}`;
    const found = this.keyed.get(k);
    if (found !== undefined) { if (runway) this.nodeRunway[found] = runway; return found; }
    const i = this.nodes.length;
    this.nodes.push({ ...p });
    this.keyed.set(k, i);
    if (runway) this.nodeRunway[i] = runway;
    return i;
  }
  link(a: number, b: number, cls: EdgeClass = 'taxi'): void {
    if (a === b) return;
    if (this.edges.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return;
    this.edges.push({ a, b, cls });
  }
  /** Chain of points, linked in order. Returns the node indices. */
  chain(pts: Vec[], cls: EdgeClass = 'taxi'): number[] {
    const ids = pts.map(p => this.node(p));
    for (let i = 1; i < ids.length; i++) this.link(ids[i - 1], ids[i], cls);
    return ids;
  }
  adjacency(): number[][] {
    const adj: number[][] = this.nodes.map(() => []);
    for (const e of this.edges) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
    return adj;
  }
}

// ---------- routing ----------

function shortestPath(ap: Airport, from: number, to: number): number[] | null {
  if (from === to) return [from];
  const n = ap.nodes.length;
  const dists = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  dists[from] = 0;
  for (;;) {
    let u = -1, best = Infinity;
    for (let i = 0; i < n; i++) if (!seen[i] && dists[i] < best) { best = dists[i]; u = i; }
    if (u === -1 || u === to) break;
    seen[u] = 1;
    for (const v of ap.adj[u]) {
      // crossing a runway is allowed but expensive, so aircraft prefer clean routes
      const extra = ap.nodeRunway[v] ? 260 : 0;
      const d = dists[u] + dist(ap.nodes[u], ap.nodes[v]) + extra;
      if (d < dists[v]) { dists[v] = d; prev[v] = u; }
    }
  }
  if (!Number.isFinite(dists[to])) return null;
  const out: number[] = [];
  for (let v = to; v !== -1; v = prev[v]) out.push(v);
  return out.reverse();
}

export interface GroundRoute { nodes: number[]; points: Vec[] }

/** Runway exit (nearest one ahead) to a stand. */
export function routeToGate(ap: Airport, runwayId: string, alongNow: number, gate: Gate): GroundRoute {
  const exits = ap.exits[runwayId] ?? [];
  const exit = exits.find(e => e.along > alongNow + 30) ?? exits[exits.length - 1];
  if (!exit) return { nodes: [gate.node], points: [gate.pos] };
  const path = shortestPath(ap, exit.off, gate.node) ?? [exit.off];
  const nodes = [exit.on, ...path];
  return { nodes, points: [...nodes.map(i => ap.nodes[i]), gate.pos] };
}

/** Stand to the holding point of a runway, split into the pushback and the taxi leg. */
export function routeToRunway(ap: Airport, gate: Gate, runwayId: string): { pushback: Vec[]; taxi: Vec[]; nodes: number[] } | null {
  const hold = ap.holds[runwayId];
  if (hold === undefined) return null;
  const path = shortestPath(ap, gate.node, hold);
  if (!path) return null;
  return {
    pushback: [ap.nodes[gate.node]],
    taxi: [...path.slice(1).map(i => ap.nodes[i]), ap.lineUp[runwayId]],
    nodes: path,
  };
}

export function freeGate(ap: Airport, cls: 'ga' | 'light' | 'medium' | 'heavy' | 'fast'): Gate | null {
  const want: GateClass[] = cls === 'ga' || cls === 'light' ? ['ga', 'gate', 'heavy'] : cls === 'heavy' ? ['heavy', 'gate'] : ['gate', 'heavy'];
  for (const k of want) { const g = ap.gates.find(x => x.cls === k && x.occupiedBy === null); if (g) return g; }
  return null;
}

// ---------- procedural island airport ----------

export function buildAirport(
  runwayId: string, threshold: Vec, dir: Vec, heading: number, L: number, w: number, side: 1 | -1, tier = 0, compact = false,
): Airport {
  const ux = dir;
  const uy = { x: -dir.y * side, y: dir.x * side };
  const W = (x: number, y: number): Vec => add(threshold, add(mul(ux, x), mul(uy, y)));
  const k = compact ? 0.62 : 1;
  const taxiY = w / 2 + 62 * k;
  const laneY = taxiY + 96 * k;
  const apronY0 = w / 2 + (62 + 22) * k, apronY1 = w / 2 + (62 + 22 + 165) * k;
  const terminalY = apronY1;
  const gaX0 = L * 0.96 + 16, gaX1 = L + 96 * k, gaY0 = apronY0, gaY1 = w / 2 + (62 + 22 + 120) * k;
  const exitsX = [L * 0.52, L * 0.7, L * 0.88];
  const connX = [L * 0.1, L * 0.5, L * 0.9];
  const holdX = -46;

  const b = new AirportBuilder();
  const alongOf = (p: Vec): number => (p.x - threshold.x) * ux.x + (p.y - threshold.y) * ux.y;
  // parallel taxiway and apron lane
  b.chain([W(holdX, taxiY), ...connX.map(x => W(x, taxiY)), ...exitsX.map(x => W(x, taxiY)), W(gaX0 + 10, taxiY), W(L + 30, taxiY)].sort((p, q) => alongOf(p) - alongOf(q)), 'taxi');
  b.chain([W(L * 0.04 + 10, laneY), ...connX.map(x => W(x, laneY)), W(L * 0.96 - 10, laneY)].sort((p, q) => alongOf(p) - alongOf(q)), 'lane');
  for (const x of connX) b.link(b.node(W(x, taxiY)), b.node(W(x, laneY)), 'taxi');
  // runway exits
  const exits: Airport['exits'] = { [runwayId]: [] };
  for (const x of exitsX) {
    const on = b.node(W(x, 0), runwayId);
    const off = b.node(W(x, taxiY));
    b.link(on, off, 'taxi');
    exits[runwayId].push({ along: x, on, off });
  }
  // holding point and line-up
  const holdN = b.node(W(holdX, taxiY));
  const entryMid = b.node(W(holdX, taxiY * 0.5));
  b.link(holdN, entryMid, 'taxi');
  b.link(entryMid, b.node(W(8, 0), runwayId), 'taxi');
  // GA apron link
  const gaLaneX = gaX0 + 10;
  const gaTop = b.node(W(gaLaneX, taxiY));
  const gaLane = b.node(W(gaLaneX, gaY0 + 20));
  b.link(gaTop, gaLane, 'taxi');

  // stands
  const gates: Gate[] = [];
  const gateCount = (compact ? 4 : 6) + Math.min(2, tier);
  const span = L * 0.84, gx0 = L * 0.08, step = span / (gateCount - 1);
  const laneChain: Vec[] = [];
  for (let i = 0; i < gateCount; i++) {
    const x = gx0 + i * step;
    laneChain.push(W(x, laneY));
    const cls: GateClass = i === 0 || i === gateCount - 1 ? 'heavy' : 'gate';
    const laneNode = b.node(W(x, laneY));
    gates.push({ id: i + 1, label: String(i + 1), pos: W(x, terminalY - 62), heading: Math.atan2(uy.y, uy.x), cls, occupiedBy: null, node: laneNode, bridge: true });
  }
  b.chain([W(L * 0.04 + 10, laneY), ...laneChain, W(L * 0.96 - 10, laneY)].sort((p, q) => alongOf(p) - alongOf(q)), 'lane');
  const gaRows = compact ? 1 : 2, gaCols = 3;
  for (let r = 0; r < gaRows; r++) for (let c = 0; c < gaCols; c++) {
    const gx = gaX0 + 22 + c * 28, gy = gaY0 + 30 + r * 50;
    const n = b.node(W(gaLaneX, gy));
    b.link(gaLane, n, 'apron');
    gates.push({ id: 100 + r * gaCols + c, label: 'GA', pos: W(gx, gy), heading, cls: 'ga', occupiedBy: null, node: n, bridge: false });
  }

  const buildings: Building[] = [];
  const B = (kind: BuildingKind, x: number, y: number, bw: number, bh: number): void => { buildings.push({ kind, pos: W(x, y), w: bw, h: bh, rot: heading }); };
  B('terminal', L * 0.5, terminalY + 26, span + 40, 52);
  if (!compact) B('pier', L * 0.5, terminalY + 52 + 40, 70, 80);
  B('tower', L * 0.62, terminalY + 52 + (compact ? 22 : 46), 22, 22);
  B('carpark', L * 0.28, terminalY + 52 + (compact ? 26 : 48), compact ? 110 : 150, compact ? 44 : 70);
  B('hangar', L * 0.1, terminalY - 20 - 120 - 36, 64, 44);
  if (tier >= 1) B('hangar', L * 0.02, terminalY - 20 - 120 - 36, 64, 44);
  B('cargo', L * 0.96 + 56, terminalY + 26, 80, 44);
  B('fuel', L * 0.96 + 60, terminalY - 70, 44, 40);
  B('fire', L * 0.5, -(w / 2 + 44), 46, 26);

  const aprons: ApronArea[] = [
    { kind: 'stand', poly: [W(L * 0.04, apronY0), W(L * 0.96, apronY0), W(L * 0.96, apronY1), W(L * 0.04, apronY1)] },
    { kind: 'ga', poly: [W(gaX0, gaY0), W(gaX1, gaY0), W(gaX1, gaY1), W(gaX0, gaY1)] },
  ];
  const lane = [W(L * 0.04 + 14, laneY + 34), W(L * 0.96 - 14, laneY + 34), W(L * 0.96 - 14, terminalY - 16), W(L * 0.04 + 14, terminalY - 16)];
  const y0 = -(w / 2 + 70), y1 = terminalY + 52 + (compact ? 60 : 108);
  const x0 = -80, x1 = L + 110;
  const c = W((x0 + x1) / 2, (y0 + y1) / 2);

  return {
    id: runwayId, nodes: b.nodes, edges: b.edges, adj: b.adjacency(), nodeRunway: b.nodeRunway,
    gates, buildings, aprons,
    vehicles: [
      { path: lane, speed: 11, phase: 0, kind: 'tug' },
      { path: lane.slice().reverse(), speed: 9, phase: 0.45, kind: 'bus' },
      { path: lane, speed: 7, phase: 0.7, kind: 'fuel' },
    ],
    exits, holds: { [runwayId]: holdN }, lineUp: { [runwayId]: W(8, 0) },
    departRunways: [runwayId],
    footprint: { x: c.x, y: c.y, w: x1 - x0, h: y1 - y0, rot: heading },
    roadAnchor: W(L * 0.28, terminalY + 52 + (compact ? 50 : 88)),
    compact,
  };
}
