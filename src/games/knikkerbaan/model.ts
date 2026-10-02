/**
 * Knikkerbaan - the logic: the boards, the marble's physics and the scoring.
 *
 * A wooden pegboard, a marble that drops from a hole at the top, a cup at the bottom, and a few
 * loose planks the child places and tilts so that the marble rolls into the cup. It practises
 * thinking ahead about where a rolling thing will go: a claim about what happens on the screen,
 * not about what a child will learn.
 *
 * Everything here is pure, so the tests can play a board without a browser. The physics is one
 * deterministic function, `step(world, dt)`, run at a fixed 1/120 s: the same planks always give
 * the same marble. That is a design decision, not a convenience: a child who changes nothing must
 * see nothing change, or "zet de plank anders" would mean nothing.
 *
 * World units: the board is `W` wide and `H` tall, y grows downwards, a marble is 0.64 across.
 */

export const W = 10;
export const H = 14;
/** The fixed physics step in seconds. The game runs several of these per frame. */
export const STEP = 1 / 120;
export const MARBLE_R = 0.32;
/** Gravity in world units per second squared: a marble falls the whole board in about 1.3 s. */
export const GRAVITY = 18;
/** Half the thickness of a plank. */
export const PLANK_T = 0.14;
/** Planks sit on the holes of the pegboard: a hole every half unit, and tilts in 15 degree steps. */
export const GRID = 0.5;
export const DEG_STEP = 15;
export const MAX_DEG = 75;
/** Product decision: a plank is slid by finger, snapped to the grid, so a solution is a region and not a pixel. */
export const MIN_SPEED_STUCK = 0.15;
/** How long the marble may lie still before the board calls it stuck, in seconds. */
export const STUCK_AFTER = 1.5;
const MAX_SPEED = 22;
/** Bounciness: planks are dead wood, pegs ring a little, the cup is felted. Product decisions, tuned by eye. */
const E_PLANK = 0.3, E_PEG = 0.45, E_CUP = 0.2, E_WALL = 0.4;
/** Below this impact speed a marble does not bounce, it rolls: what makes it roll and not chatter. */
const REST_SPEED = 1.5;
/** Rolling resistance per second while touching wood. */
const ROLL = 0.5;

export const CUP_INNER = 1.5;
export const CUP_RIM_Y = H - 1.3;
const CUP_WALL = 0.1;

export interface Vec { x: number; y: number }
export interface Peg { x: number; y: number; r: number }
/** A plank by its centre; `deg` 0 is flat, positive tilts down to the right. */
export interface Plank { x: number; y: number; deg: number; len: number }
export type Outcome = 'cup' | 'floor' | 'stuck';

export interface Level {
  id: number;
  name: string;
  nameNl: string;
  hint: string;
  hintNl: string;
  drop: Vec;
  cupX: number;
  pegs: Peg[];
  /** screwed to the board: the child cannot move these */
  fixed: Plank[];
  /** the loose planks in the tray, by length: the tray is exactly this many */
  tray: number[];
  /** one way to solve it, which the tests play and the hint can lean on */
  solution: Plank[];
}

const peg = (x: number, y: number, r = 0.2): Peg => ({ x, y, r });

export const LEVELS: Level[] = [
  {
    id: 1, name: 'A little nudge', nameNl: 'Een duwtje',
    hint: 'Put a plank at a slant under the marble. It will roll to the cup.',
    hintNl: 'Zet een plank schuin onder de knikker. Dan rolt hij naar het bekertje.',
    drop: { x: 4.0, y: 0.8 }, cupX: 5.6, pegs: [], fixed: [], tray: [3, 3], solution: [{ x: 2.5, y: 6, deg: -15, len: 3 }],
  },
  {
    id: 2, name: 'To the side', nameNl: 'Naar de zijkant',
    hint: 'The cup is far away. Make a long slope all the way across.',
    hintNl: 'Het bekertje is ver weg. Maak een lange helling naar de andere kant.',
    drop: { x: 1.8, y: 0.8 }, cupX: 8.2, pegs: [], fixed: [], tray: [3.5, 3.5], solution: [{ x: 2, y: 6, deg: 15, len: 3.5 }],
  },
  {
    id: 3, name: 'A peg in the way', nameNl: 'Een pen in de weg',
    hint: 'Let the marble roll past the peg. A slanted plank helps.',
    hintNl: 'Laat de knikker langs de pen rollen. Een schuine plank helpt.',
    drop: { x: 3.2, y: 0.8 }, cupX: 6.6, pegs: [peg(3.5, 7, 0.5)], fixed: [], tray: [3, 3], solution: [{ x: 2, y: 4.5, deg: 15, len: 3 }],
  },
  {
    id: 4, name: 'Two planks', nameNl: 'Twee planken',
    hint: 'You have two planks. Try both of them.',
    hintNl: 'Je hebt twee planken. Probeer ze allebei.',
    drop: { x: 0.9, y: 0.8 }, cupX: 8.9, pegs: [peg(8.2, 5, 0.4)], fixed: [{ x: 3.4, y: 7.5, deg: 0, len: 6.8 }], tray: [2.5, 2.5], solution: [{ x: 2, y: 4, deg: -45, len: 2.5 }],
  },
  {
    id: 5, name: 'The funnel', nameNl: 'De trechter',
    hint: 'Bring the marble to the funnel. The pegs steer it into the cup.',
    hintNl: 'Breng de knikker naar de trechter. De pennen sturen hem naar het bekertje.',
    drop: { x: 2.0, y: 0.8 }, cupX: 7.0,
    pegs: [peg(5.2, 8.0), peg(5.6, 8.9), peg(6.0, 9.8), peg(6.4, 10.6), peg(8.8, 8.0), peg(8.4, 8.9), peg(8.0, 9.8), peg(7.6, 10.6)],
    fixed: [], tray: [3], solution: [{ x: 3, y: 4.5, deg: 15, len: 3 }],
  },
  {
    id: 6, name: 'The jump', nameNl: 'De sprong',
    hint: 'There is a gap. Give the marble a push so it jumps across.',
    hintNl: 'Er zit een gat in. Geef de knikker een duwtje, dan springt hij erover.',
    drop: { x: 1.2, y: 0.8 }, cupX: 8.4, pegs: [],
    fixed: [{ x: 2.2, y: 5.6, deg: 15, len: 4 }, { x: 8.0, y: 9.0, deg: -15, len: 3.6 }], tray: [3, 3], solution: [{ x: 5.5, y: 11, deg: 45, len: 3 }],
  },
  {
    id: 7, name: 'Three planks', nameNl: 'Drie planken',
    hint: 'There are only three planks. Look closely where the marble rolls.',
    hintNl: 'Er zijn maar drie planken. Kijk goed waar de knikker heen rolt.',
    drop: { x: 8.6, y: 0.8 }, cupX: 8.6, pegs: [], fixed: [{ x: 6.5, y: 4.5, deg: 0, len: 7 }, { x: 3.4, y: 8.5, deg: 0, len: 6.8 }], tray: [2.5, 2.5, 2.5], solution: [{ x: 1.5, y: 4, deg: -60, len: 2.5 }, { x: 2, y: 6, deg: 15, len: 2.5 }, { x: 7.5, y: 2.5, deg: -15, len: 2.5 }],
  },
  {
    id: 8, name: 'Under the ledge', nameNl: 'Onder de richel',
    hint: 'The cup sits under a ledge. Roll the marble in from the side.',
    hintNl: 'Het bekertje zit onder een richel. Rol de knikker van opzij naar binnen.',
    drop: { x: 2.5, y: 0.8 }, cupX: 8.2, pegs: [], fixed: [{ x: 8.2, y: 10.2, deg: 0, len: 3.4 }], tray: [3, 3], solution: [{ x: 1.5, y: 9.5, deg: 30, len: 3 }],
  },
];

// ------------------------------------------------------------------ geometry

export const plankEnds = (p: Plank): [Vec, Vec] => {
  const a = (p.deg * Math.PI) / 180, hx = Math.cos(a) * p.len / 2, hy = Math.sin(a) * p.len / 2;
  return [{ x: p.x - hx, y: p.y - hy }, { x: p.x + hx, y: p.y + hy }];
};

export interface Seg { ax: number; ay: number; bx: number; by: number; r: number; e: number }

function closest(px: number, py: number, s: Seg): Vec {
  const dx = s.bx - s.ax, dy = s.by - s.ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / l2));
  return { x: s.ax + dx * t, y: s.ay + dy * t };
}

const dist = (px: number, py: number, s: Seg): number => { const q = closest(px, py, s); return Math.hypot(px - q.x, py - q.y); };

function crosses(a: Seg, b: Seg): boolean {
  const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number): number => (qx - px) * (ry - py) - (qy - py) * (rx - px);
  const d1 = o(a.ax, a.ay, a.bx, a.by, b.ax, b.ay), d2 = o(a.ax, a.ay, a.bx, a.by, b.bx, b.by);
  const d3 = o(b.ax, b.ay, b.bx, b.by, a.ax, a.ay), d4 = o(b.ax, b.ay, b.bx, b.by, a.bx, a.by);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function segGap(a: Seg, b: Seg): number {
  if (crosses(a, b)) return 0;
  return Math.min(dist(a.ax, a.ay, b), dist(a.bx, a.by, b), dist(b.ax, b.ay, a), dist(b.bx, b.by, a));
}

const plankSeg = (p: Plank): Seg => { const [a, b] = plankEnds(p); return { ax: a.x, ay: a.y, bx: b.x, by: b.y, r: PLANK_T, e: E_PLANK }; };

/** The three sides of the cup, as thin felted walls. */
export function cupSegs(cupX: number): Seg[] {
  const l = cupX - CUP_INNER / 2 - CUP_WALL, r = cupX + CUP_INNER / 2 + CUP_WALL, top = CUP_RIM_Y, bot = H - 0.1;
  return [
    { ax: l, ay: top, bx: l, by: bot, r: CUP_WALL, e: E_CUP },
    { ax: r, ay: top, bx: r, by: bot, r: CUP_WALL, e: E_CUP },
    { ax: l, ay: bot, bx: r, by: bot, r: CUP_WALL, e: E_CUP },
  ];
}

export const snap = (v: number): number => Math.round(v / GRID) * GRID;
export const snapDeg = (d: number): number => Math.max(-MAX_DEG, Math.min(MAX_DEG, Math.round(d / DEG_STEP) * DEG_STEP));

/**
 * Can this plank sit here? Inside the board, clear of every peg, every other plank, the cup and
 * the marble's start. `others` are the planks already placed (not the one being tested).
 */
export function placementOk(level: Level, others: Plank[], p: Plank): boolean {
  const s = plankSeg(p);
  const margin = 0.06;
  for (const [x, y] of [[s.ax, s.ay], [s.bx, s.by]]) {
    if (x < 0.15 || x > W - 0.15 || y < 1.5 || y > CUP_RIM_Y - 0.4) return false;
  }
  for (const g of level.pegs) if (dist(g.x, g.y, s) < g.r + PLANK_T + margin) return false;
  for (const o of [...level.fixed, ...others]) if (segGap(s, plankSeg(o)) < 2 * PLANK_T + margin) return false;
  for (const c of cupSegs(level.cupX)) if (segGap(s, c) < PLANK_T + c.r + margin) return false;
  if (dist(level.drop.x, level.drop.y, s) < MARBLE_R + PLANK_T + 0.15) return false;
  return true;
}

/** The nearest legal spot to a plank that was let go somewhere it cannot stay, or null. */
export function nearestPlacement(level: Level, others: Plank[], p: Plank): Plank | null {
  const base = { ...p, x: snap(p.x), y: snap(p.y), deg: snapDeg(p.deg) };
  if (placementOk(level, others, base)) return base;
  for (let ring = 1; ring <= 4; ring++) {
    let best: Plank | null = null, bd = 1e9;
    for (let i = -ring; i <= ring; i++) {
      for (let j = -ring; j <= ring; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const q = { ...base, x: base.x + i * GRID, y: base.y + j * GRID };
        const d = i * i + j * j;
        if (d < bd && placementOk(level, others, q)) { best = q; bd = d; }
      }
    }
    if (best) return best;
  }
  return null;
}

// ------------------------------------------------------------------ physics

export interface Marble { x: number; y: number; vx: number; vy: number; rot: number }

export interface World {
  level: Level;
  planks: Plank[];
  segs: Seg[];
  marble: Marble;
  t: number;
  still: number;
  result: Outcome | null;
  /** how many hard knocks so far and how hard the last was, for the sound; `bumpKind` says on what */
  bumps: number;
  bumpSpeed: number;
  bumpKind: 'peg' | 'plank' | 'cup' | 'wall';
}

export function makeWorld(level: Level, planks: Plank[] = level.solution): World {
  const segs = [...level.fixed, ...planks].map(plankSeg).concat(cupSegs(level.cupX));
  return {
    level, planks: planks.map(p => ({ ...p })), segs,
    marble: { x: level.drop.x, y: level.drop.y, vx: 0, vy: 0, rot: 0 },
    t: 0, still: 0, result: null, bumps: 0, bumpSpeed: 0, bumpKind: 'plank',
  };
}

/** Push the marble out of a round obstacle and bounce it. Returns true if it touched. */
function hit(w: World, qx: number, qy: number, rad: number, e: number, kind: World['bumpKind']): boolean {
  const m = w.marble;
  const dx = m.x - qx, dy = m.y - qy;
  const min = MARBLE_R + rad;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min) return false;
  const d = Math.sqrt(d2);
  const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : -1;
  m.x = qx + nx * min; m.y = qy + ny * min;
  const vn = m.vx * nx + m.vy * ny;
  if (vn < 0) {
    const bounce = -vn > REST_SPEED ? e : 0;
    m.vx -= (1 + bounce) * vn * nx;
    m.vy -= (1 + bounce) * vn * ny;
    if (-vn > REST_SPEED) { w.bumps++; w.bumpSpeed = -vn; w.bumpKind = kind; }
  }
  return true;
}

/** One fixed step of the world. Deterministic: the same world and the same dt give the same marble. */
export function step(w: World, dt: number = STEP): void {
  if (w.result) return;
  const m = w.marble;
  m.vy += GRAVITY * dt;
  const sp = Math.hypot(m.vx, m.vy);
  if (sp > MAX_SPEED) { m.vx *= MAX_SPEED / sp; m.vy *= MAX_SPEED / sp; }
  m.x += m.vx * dt; m.y += m.vy * dt;
  let touching = false;
  for (let it = 0; it < 3; it++) {
    for (const g of w.level.pegs) if (hit(w, g.x, g.y, g.r, E_PEG, 'peg')) touching = true;
    for (const s of w.segs) {
      const q = closest(m.x, m.y, s);
      if (hit(w, q.x, q.y, s.r, s.e, s === w.segs[w.segs.length - 1] || w.segs.indexOf(s) >= w.segs.length - 3 ? 'cup' : 'plank')) touching = true;
    }
    if (m.x < MARBLE_R) { m.x = MARBLE_R; if (m.vx < 0) { m.vx *= -E_WALL; } }
    if (m.x > W - MARBLE_R) { m.x = W - MARBLE_R; if (m.vx > 0) { m.vx *= -E_WALL; } }
  }
  // rolling resistance only while on wood, so a free fall is not slowed
  if (touching) { const k = 1 - ROLL * dt; m.vx *= k; m.vy *= k; }
  m.rot += (m.vx * dt) / MARBLE_R;
  w.t += dt;

  const cx = w.level.cupX;
  if (m.y > CUP_RIM_Y + 0.25 && Math.abs(m.x - cx) < CUP_INNER / 2) { w.result = 'cup'; return; }
  if (m.y > H - 0.35) { w.result = 'floor'; return; }
  w.still = Math.hypot(m.vx, m.vy) < MIN_SPEED_STUCK ? w.still + dt : 0;
  if (w.still > STUCK_AFTER) w.result = 'stuck';
}

/** Run a world to its end, or to `maxSeconds`, and say where the marble ended. A marble still rolling then counts as stuck. */
export function simulate(w: World, maxSeconds = 40): Outcome {
  const n = Math.ceil(maxSeconds / STEP);
  for (let i = 0; i < n && !w.result; i++) step(w);
  return w.result ?? 'stuck';
}

/** Run a board with these planks from the start. */
export const playBoard = (level: Level, planks: Plank[], maxSeconds = 40): Outcome => simulate(makeWorld(level, planks), maxSeconds);

// ------------------------------------------------------------------ scoring

/**
 * Stars for a board: 3 if the first drop lands, 2 if the second or third does, 1 otherwise.
 * This is a product decision, not research: it only says how many tries the child wanted. Nothing
 * is ever lost, a board that lands at all is finished, and the number of drops is never shown.
 */
export function starsForDrops(drops: number): number {
  if (drops <= 1) return 3;
  if (drops <= 3) return 2;
  return 1;
}

export const saveKey = (l: Level): string => `knikkerbaan:${l.id}`;
