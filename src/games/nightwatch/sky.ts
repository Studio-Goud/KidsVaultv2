/**
 * Night Watch's rules, with no canvas anywhere in them.
 *
 * The game used to own six rounds and eight hand-drawn figures, and when you had seen the eighth
 * there was nothing above it. The figures are the good part - a child can name a hare, and naming
 * it is half of remembering it - so they stay, as the opening run, in rising order. What changes is
 * that they are no longer the ceiling. Past the last one the sky keeps making figures, out of the
 * one number the platform hands back: how many stars, how many lines, how tightly the look-alikes
 * crowd them, how long you get to look, whether the lines fade together or one at a time, and
 * whether the sky turns before you draw.
 *
 * Two hard rules sit under the generator, and both of them are about a finger rather than a screen:
 *
 *  - Every generated figure is drawable in **one continuous stroke**. It is built as a walk, so the
 *    edge list *is* the stroke; `oneStrokeOrder` proves it after the fact, and says which of the
 *    hand-made figures manage it too.
 *  - No two stars ever sit closer than a fingertip can separate, and that distance is worked out
 *    from the radius the stars are really drawn at plus the width of a fingertip - not from a round
 *    number that looked about right. A line of the figure also keeps its distance from every star
 *    that is not one of its ends, because a swipe that runs along a line must not pick up a
 *    bystander.
 */

import { clamp, dist, pointSegment, TAU, type Vec } from '../../util/math';
import { makeRng } from '../../util/rng';
import { knobsFor, nextStep, type Attempt, type Knobs, type Mastery, type Step } from '../../platform/skill';
import { FIGURES, type Figure } from './figures';

// ---------------------------------------------------------------- how big, how far apart

/** the radius a star of the figure is drawn at, before the twinkle, at scale 1 */
export const FIGURE_STAR_R = 4.6;
/** the widest a look-alike star is drawn */
export const DISTRACTOR_STAR_R = 4.8;
/** a star of the figure swells by this much while the sky is showing it */
export const LIT_SWELL = 1.5;
/** half a fingertip on a phone screen, in CSS pixels: about 4.5 mm */
export const FINGER_R = 22;

/** the widest any star is ever drawn, which is a lit one at full twinkle */
export const widestStarR = (u: number): number =>
  Math.max(FIGURE_STAR_R * LIT_SWELL, DISTRACTOR_STAR_R) * u;

/**
 * The closest two stars may ever be.
 *
 * A fingertip has to land nearer one than the other, so the centres must be at least one fingertip
 * radius apart *plus* both star bodies - otherwise the two discs of light themselves are already
 * touching under the finger. On a big screen the field grows faster than the finger does, so a
 * share of the field is the floor.
 */
export function minStarGap(u: number, fieldS: number): number {
  return Math.max(FINGER_R * u + widestStarR(u) * 2, fieldS * 0.075);
}

/** How near a finger has to come to a star to pick it up. Generous, because thumbs are not mice. */
export function grabRadius(u: number, fieldS: number): number {
  return Math.max(26 * u, fieldS * 0.055);
}

/**
 * How far a star that is not an end of a line has to stay clear of that line.
 *
 * This one was measured the hard way. It started at nine tenths of the reach, which is to say
 * *inside* it, and the first swipe driven across a real Whale picked up a look-alike sitting beside
 * the line between two of its stars - the finger was dead on the line and the bystander was still
 * the nearest thing to it. A finger tracing a line must never meet anything but the two ends of
 * that line, so the clearance has to be wider than the reach, with room left over for a wobble.
 */
export const lineClearance = (u: number, fieldS: number): number =>
  Math.max(grabRadius(u, fieldS) * 1.3, minStarGap(u, fieldS) * 0.85);

/** A point this much nearer one star than the next is on that star; anything closer is a refusal. */
export const AMBIGUOUS_SHARE = 0.18;

/** The play field, in pixels: where the sky the game uses actually is. */
export interface Field { x: number; y: number; w: number; h: number; s: number }

/**
 * The strips above and below the sky.
 *
 * On a phone held upright they are the numbers they have always been. On a phone turned sideways
 * the whole safe box is only about 390 tall, and giving 218 of it to a heading and a button left
 * the sky so short that two stars of the Hare came within a fingertip of each other. So on a short
 * screen the strips take a share of it instead of a fixed amount.
 */
export const headRoom = (u: number, h: number): number => Math.min(122 * u, h * 0.22);
export const footRoom = (u: number, h: number): number => Math.min(96 * u, h * 0.17);

/**
 * The sky itself. It follows the screen rather than staying square, so a tablet held sideways
 * actually uses its width, but never stretches further than 1.4 to 1 or the figures would start to
 * look like different figures.
 */
export function playField(w: number, h: number, u: number): Field {
  const top = headRoom(u, h), bottom = footRoom(u, h);
  const availW = w - 40 * u, availH = h - top - bottom;
  let fw = availW, fh = availH;
  if (fw / fh > 1.4) fw = fh * 1.4;
  if (fh / fw > 1.4) fh = fw * 1.4;
  return { x: (w - fw) / 2, y: top + (availH - fh) / 2, w: fw, h: fh, s: Math.min(fw, fh) };
}

/**
 * How many stars a field can hold at that spacing before it stops being a sky and becomes a mess.
 * The 0.35 is what scattering actually achieves against a perfect packing, measured rather than
 * hoped: past that the placer spends its whole budget rejecting.
 */
export function capacity(f: Field, u: number): number {
  const g = minStarGap(u, f.s);
  return Math.max(5, Math.floor((f.w * f.h * 0.35) / (g * g)));
}

// ---------------------------------------------------------------- one stroke

const ekey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);

/**
 * The same edges, reordered so one finger could draw them all without lifting, or `null` when no
 * such order exists.
 *
 * This is Euler's bridges: a run over every edge exactly once exists when the figure is in one
 * piece and no more than two of its stars have an odd number of lines. Hierholzer's walk finds it.
 * The returned pairs are pointed the way the finger goes, so `out[i][1] === out[i+1][0]`.
 */
export function oneStrokeOrder(
  edges: ReadonlyArray<readonly [number, number]>,
): Array<[number, number]> | null {
  if (edges.length === 0) return null;
  const nodes = new Set<number>();
  for (const [a, b] of edges) {
    if (a === b) return null;
    nodes.add(a); nodes.add(b);
  }
  const adj = new Map<number, number[]>();
  for (const v of nodes) adj.set(v, []);
  edges.forEach(([a, b], i) => { adj.get(a)!.push(i); adj.get(b)!.push(i); });

  const odd = [...nodes].filter(v => adj.get(v)!.length % 2 === 1).sort((a, b) => a - b);
  if (odd.length !== 0 && odd.length !== 2) return null;

  const start = odd.length === 2 ? odd[0] : Math.min(...nodes);
  const used = new Array<boolean>(edges.length).fill(false);
  const ptr = new Map<number, number>([...nodes].map(v => [v, 0] as [number, number]));
  const stack: number[] = [start];
  const trail: number[] = [];
  while (stack.length) {
    const v = stack[stack.length - 1];
    const list = adj.get(v)!;
    let i = ptr.get(v)!;
    while (i < list.length && used[list[i]]) i++;
    ptr.set(v, i);
    if (i === list.length) { trail.push(stack.pop()!); continue; }
    const id = list[i];
    used[id] = true;
    const [a, b] = edges[id];
    stack.push(a === v ? b : a);
  }
  if (used.some(u => !u)) return null;          // the figure is in more than one piece
  trail.reverse();
  const out: Array<[number, number]> = [];
  for (let i = 1; i < trail.length; i++) out.push([trail[i - 1], trail[i]]);
  return out.length === edges.length ? out : null;
}

/** Whether an edge list is already in one-stroke order: each line starting where the last ended. */
export function isOneStroke(edges: ReadonlyArray<readonly [number, number]>): boolean {
  if (edges.length === 0) return false;
  for (let i = 1; i < edges.length; i++) if (edges[i - 1][1] !== edges[i][0]) return false;
  const seen = new Set<string>();
  for (const [a, b] of edges) {
    if (a === b) return false;
    const k = ekey(a, b);
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

// ---------------------------------------------------------------- the figures

export type Fade = 'together' | 'oneByOne';

/** One round's worth of sky: the figure, and everything about how it is presented. */
export interface Puzzle {
  id: string;
  /** a hand-made figure keeps its name and its lore; a generated one is labelled by its counts */
  made: boolean;
  name: string;
  nameNl: string;
  /** the i18n key of this figure's bit of sky lore, empty for a generated one */
  lore: string;
  /** star positions in a 0..1 square, y downwards */
  stars: Array<[number, number]>;
  /** the lines, pointed the way they are drawn */
  edges: Array<[number, number]>;
  /** true when the whole figure can be drawn without lifting a finger */
  oneStroke: boolean;
  /** how many look-alike stars to scatter around it */
  distractors: number;
  /** how tightly those look-alikes crowd the real stars, 0 scattered, 1 right up against them */
  crowd: number;
  /** how long the figure stays lit */
  showMs: number;
  /** how long drawing it back ought to take */
  parMs: number;
  /** the lines go out together, or one at a time while you are still looking */
  fade: Fade;
  /** quarter turns the sky makes once the lines have gone out */
  turn: number;
  /** the sky is flipped left for right once the lines have gone out */
  mirror: boolean;
}

/** The biggest a generated figure ever gets. Past this it stops being a figure. */
export const NODE_CAP = 11;
export const EDGE_CAP = 14;

/** The stretch of the dial the hand-made figures occupy before the sky starts making its own. */
export const HAND_MADE_SPAN = 0.5;
/** How far past a figure's own rung a child may already be and still be shown it. */
export const LADDER_SLACK = 0.12;
/**
 * And how far *below* their rung it may sit before it stops being worth showing. A child who comes
 * back already halfway up should not have to walk the Kite again to get to the Deer; the run stays
 * in rising order, it just starts where they are.
 */
export const LADDER_REACH = 0.22;

/** The hand-made figures, easiest first, each on the rung of the dial it belongs to. */
export function madeLadder(): Array<{ figure: Figure; at: number }> {
  const order = [...FIGURES].sort((a, b) =>
    a.edges.length - b.edges.length || a.stars.length - b.stars.length || (a.id < b.id ? -1 : 1));
  const last = Math.max(1, order.length - 1);
  return order.map((figure, i) => ({ figure, at: (i / last) * HAND_MADE_SPAN }));
}

export const knobsOf = (d: number): Knobs => knobsFor(d, { elements: NODE_CAP, steps: EDGE_CAP });

/** How long drawing a figure back ought to take a child who knows it. */
export const parMsFor = (edges: number, distractors: number): number =>
  Math.round(1400 + edges * 1150 + distractors * 55);

/**
 * Whether the sky turns over before the child draws, and which way.
 *
 * This is the one trick at the top of the dial and it arrives last, because holding a shape while
 * it rotates is a much later skill than holding a bigger shape. It is decided before anything is
 * placed, because a quarter turn changes the shape of the space the figure has to live in.
 */
function turnAndMirror(d: number, rng: () => number): { turn: number; mirror: boolean } {
  const k = knobsOf(d);
  return {
    turn: k.memory > 0.55 ? 1 + Math.floor(rng() * 3) : 0,
    mirror: k.memory > 0.8 && rng() < 0.5,
  };
}

/**
 * A quarter turn has to happen inside a square, or a figure laid out across a tall field would
 * swing off the sides of it. A half turn, and no turn at all, keep the field they were given.
 */
export const frameFor = (f: Field, turn: number): Field => (turn % 2 === 1 ? squareOf(f) : f);

/** The closest two stars of a figure come once it is laid into a frame, in pixels. */
export function figureClosest(stars: ReadonlyArray<readonly [number, number]>, frame: Field): number {
  let worst = Infinity;
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) worst = Math.min(worst, pxDist(stars[i], stars[j], frame));
  }
  return worst;
}

/**
 * Everything about a figure that is not the figure: how many look-alikes, how tightly they crowd,
 * how long it is lit, and whether the lines go out together. All of it off the one dial, each knob
 * starting at its own point - more stars to look at long before the lines start going out one at a
 * time, because counting more is easier than assembling a shape you never see whole.
 *
 * A bigger figure gets more seconds and fewer of them *per line*, which is where the pressure
 * really comes from. Eleven lines in three seconds is a far harder look than six lines in two, and
 * the alternative - holding the total still - would just make a long figure unreadable.
 */
function dressing(
  d: number, edgeCount: number, figureStars: number, f: Field, u: number,
): Pick<Puzzle, 'distractors' | 'crowd' | 'showMs' | 'parMs' | 'fade'> {
  const k = knobsOf(d);
  // Look-alikes are counted against the figure rather than against the screen. Counting them
  // against the screen filled a tall phone with forty-six stars at the top of the dial - which is
  // what the field holds at a safe spacing, and far past what reads as a sky. Two per real star at
  // the very top is already a hard look. The field still has the last word: three quarters of what
  // it could hold, because a sky packed to its limit is a wall of light rather than stars.
  const room = Math.max(0, Math.floor(capacity(f, u) * 0.75) - figureStars);
  const distractors = Math.max(3, Math.min(room, Math.round(2 + figureStars * (0.6 + k.distractors * 1.2))));
  const showMs = Math.round(clamp((1500 + edgeCount * 430) / k.speed, 1200, 6000));
  return {
    distractors,
    crowd: k.distractors,
    showMs,
    parMs: parMsFor(edgeCount, distractors),
    fade: k.memory > 0.35 ? 'oneByOne' : 'together',
  };
}

/**
 * A hand-made figure, dressed for the rung the child is on.
 *
 * The only thing that can be refused here is the quarter turn: these stars were placed by hand in
 * a square, and squeezing that square into the middle of a short landscape field can bring two of
 * them inside a fingertip of each other. When it would, the sky takes a half turn instead, which
 * needs no squeezing at all.
 */
export function madePuzzle(figure: Figure, d: number, f: Field, u: number, seed: number): Puzzle {
  const rng = makeRng(seed);
  const stroke = oneStrokeOrder(figure.edges);
  const edges = stroke ?? figure.edges.map(([a, b]) => [a, b] as [number, number]);
  let { turn, mirror } = turnAndMirror(d, rng);
  if (turn % 2 === 1 && figureClosest(figure.stars, squareOf(f)) < minStarGap(u, f.s)) turn = 2;
  return {
    id: figure.id,
    made: true,
    name: figure.name,
    nameNl: figure.nameNl,
    lore: figure.lore,
    stars: figure.stars.map(([x, y]) => [x, y] as [number, number]),
    edges,
    oneStroke: stroke !== null,
    turn,
    mirror,
    ...dressing(d, edges.length, figure.stars.length, f, u),
  };
}

const pxDist = (a: readonly [number, number], b: readonly [number, number], f: Field): number =>
  Math.hypot((a[0] - b[0]) * f.w, (a[1] - b[1]) * f.h);

const pxAt = (p: readonly [number, number], f: Field): Vec => ({ x: p[0] * f.w, y: p[1] * f.h });

/** Points scattered in the 0..1 square, never two of them closer than a fingertip can split. */
function scatter(n: number, gap: number, f: Field, rng: () => number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const lo = 0.06, span = 0.88;
  for (let guard = 0; pts.length < n && guard < 9000; guard++) {
    const p: [number, number] = [lo + rng() * span, lo + rng() * span];
    if (pts.some(q => pxDist(q, p, f) < gap)) continue;
    pts.push(p);
  }
  return pts;
}

/** Two segments that cross somewhere other than at a shared end. */
function crosses(
  a: readonly [number, number], b: readonly [number, number],
  c: readonly [number, number], e: readonly [number, number], f: Field,
): boolean {
  const p = pxAt(a, f), q = pxAt(b, f), r = pxAt(c, f), s = pxAt(e, f);
  const side = (o: Vec, u2: Vec, v: Vec): number =>
    Math.sign((u2.x - o.x) * (v.y - o.y) - (u2.y - o.y) * (v.x - o.x));
  const d1 = side(p, q, r), d2 = side(p, q, s), d3 = side(r, s, p), d4 = side(r, s, q);
  return d1 !== d2 && d3 !== d4;
}

/** Whether a line from one star to another leaves every other star its clearance. */
function clearOfStars(
  pts: ReadonlyArray<readonly [number, number]>, a: number, b: number, clear: number, f: Field,
): boolean {
  const pa = pxAt(pts[a], f), pb = pxAt(pts[b], f);
  for (let i = 0; i < pts.length; i++) {
    if (i === a || i === b) continue;
    if (pointSegment(pxAt(pts[i], f), pa, pb).d < clear) return false;
  }
  return true;
}

/**
 * The lines, built as a walk rather than chosen as a set.
 *
 * Starting somewhere and stepping from star to star, never over a line already drawn, gives an edge
 * list that is a single stroke by construction - there is no search and no failure case. The walk
 * prefers a star it has not been to yet (so the whole figure gets used) and then the nearest one
 * (so it looks like a constellation rather than a scribble), and refuses any step that would cross
 * a line it has already drawn or run too near a star that is not its own end.
 */
function walkEdges(
  pts: ReadonlyArray<readonly [number, number]>, want: number, f: Field, u: number, rng: () => number,
  start: number,
): Array<[number, number]> {
  const n = pts.length;
  const clear = lineClearance(u, f.s);
  const diag = Math.hypot(f.w, f.h);
  const done = new Set<string>();
  const out: Array<[number, number]> = [];
  const seen = new Set<number>([start]);
  let cur = start;
  while (out.length < want) {
    let best = -1, bestScore = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === cur || done.has(ekey(cur, j))) continue;
      if (!clearOfStars(pts, cur, j, clear, f)) continue;
      if (out.some(([a, b]) => a !== cur && b !== cur && a !== j && b !== j && crosses(pts[cur], pts[j], pts[a], pts[b], f))) continue;
      const score = (seen.has(j) ? 0.85 : 0) + (pxDist(pts[cur], pts[j], f) / diag) * 1.5 + rng() * 0.18;
      if (score < bestScore) { bestScore = score; best = j; }
    }
    if (best < 0) break;
    done.add(ekey(cur, best));
    out.push([cur, best]);
    seen.add(best);
    cur = best;
  }
  return out;
}

/**
 * A figure the sky made up, out of the dial alone.
 *
 * The turn is settled first, because it decides the frame: a figure that is going to be turned a
 * quarter has to be scattered inside the square it will turn in, or the spacing worked out here
 * would not be the spacing the child's finger meets.
 */
export function generatedPuzzle(d: number, f: Field, u: number, seed: number): Puzzle {
  const rng = makeRng(seed);
  const k = knobsOf(d);
  const { turn, mirror } = turnAndMirror(d, rng);
  const frame = frameFor(f, turn);
  const gap = minStarGap(u, f.s);
  const wantStars = Math.max(4, Math.min(k.elements, NODE_CAP, Math.floor(capacity(frame, u) * 0.45)));
  const pts = scatter(wantStars, gap, frame, rng);
  const wantEdges = Math.max(3, Math.min(k.steps, EDGE_CAP, Math.floor(pts.length * 1.5)));

  // a walk can paint itself into a corner; six starts, and the longest one wins
  let walk: Array<[number, number]> = [];
  for (let attempt = 0; attempt < 6 && walk.length < wantEdges; attempt++) {
    const got = walkEdges(pts, wantEdges, frame, u, rng, Math.floor(rng() * pts.length));
    if (got.length > walk.length) walk = got;
  }
  if (walk.length < 3) walk = chain(pts, frame);

  const used = [...new Set(walk.flat())].sort((a, b) => a - b);
  const at = new Map(used.map((v, i) => [v, i] as [number, number]));
  const stars = used.map(i => pts[i]);
  const edges = walk.map(([a, b]) => [at.get(a)!, at.get(b)!] as [number, number]);
  return {
    id: `made-up-${stars.length}-${edges.length}-${seed}`,
    made: false,
    name: '', nameNl: '', lore: '',
    stars,
    edges,
    oneStroke: isOneStroke(edges),
    turn,
    mirror,
    ...dressing(d, edges.length, stars.length, f, u),
  };
}

/** The last resort: a nearest-neighbour thread through the points, which is always one stroke. */
function chain(pts: ReadonlyArray<readonly [number, number]>, f: Field): Array<[number, number]> {
  const left = new Set(pts.map((_, i) => i));
  const out: Array<[number, number]> = [];
  let cur = 0;
  left.delete(0);
  while (left.size) {
    let best = -1, bd = Infinity;
    for (const j of left) { const d = pxDist(pts[cur], pts[j], f); if (d < bd) { bd = d; best = j; } }
    out.push([cur, best]);
    left.delete(best);
    cur = best;
  }
  return out;
}

// ---------------------------------------------------------------- what to ask next

/**
 * The two skills Night Watch leans on, read as one.
 *
 * Holding the shape is the work, so visual memory carries most of the weight; seeing that a figure
 * is the same figure turned round is pattern, and it carries the rest. The slump is the worse of
 * the two and the streak the better-earned of the two, so a child who has gone wrong twice at
 * either gets a bridge.
 */
export function blend(vm: Mastery, pattern: Mastery): Mastery {
  return {
    level: vm.level * 0.65 + pattern.level * 0.35,
    seen: Math.max(vm.seen, pattern.seen),
    streak: Math.min(vm.streak, pattern.streak),
    slump: Math.max(vm.slump, pattern.slump),
  };
}

export interface Plan {
  puzzle: Puzzle;
  difficulty: number;
  move: Step['move'];
}

/**
 * The next figure.
 *
 * The hand-made ones come first, in rising order, each waiting on its own rung - a child who has
 * not got that far does not meet the Deer yet, and one who came back already strong starts partway
 * along the run rather than at the bottom of it, or walks past the lot of them into made-up skies.
 * Once they have all been seen tonight, the sky makes its own, and it never runs out.
 */
export function planNext(o: {
  vm: Mastery;
  pattern: Mastery;
  recent: Attempt[];
  /** the hand-made figures already brought back tonight */
  seenMade: string[];
  field: Field;
  u: number;
  seed: number;
}): Plan {
  const step = nextStep(blend(o.vm, o.pattern), o.recent);
  const d = step.difficulty;
  const rung = madeLadder().find(r =>
    !o.seenMade.includes(r.figure.id) && r.at <= d + LADDER_SLACK && r.at >= d - LADDER_REACH);
  const puzzle = rung
    ? madePuzzle(rung.figure, d, o.field, o.u, o.seed)
    : generatedPuzzle(d, o.field, o.u, o.seed);
  return { puzzle, difficulty: d, move: step.move };
}

// ---------------------------------------------------------------- putting it on the screen

export interface Placed {
  x: number; y: number;
  /** the radius it is drawn at, before the twinkle */
  r: number;
  twinkle: number;
  /** which star of the figure this is, or null for a look-alike */
  fig: number | null;
}

/** A quarter turn needs a square, or the figure would swing off the sides of a tall field. */
export function squareOf(f: Field): Field {
  const s = Math.min(f.w, f.h);
  return { x: f.x + (f.w - s) / 2, y: f.y + (f.h - s) / 2, w: s, h: s, s };
}

/**
 * The stars, in pixels, where the game will actually draw them.
 *
 * The figure goes down first and keeps its shape; the look-alikes are then thrown in around it,
 * each one refused if it lands within a fingertip of another star or close enough to a line of the
 * figure to be picked up by a finger sliding along it. If the field cannot hold as many as the
 * dial asked for, it gets fewer - a small screen is a smaller sky, not a crowded one.
 */
export function layoutSky(
  p: Puzzle, field: Field, u: number, seed: number,
): { stars: Placed[]; figureStars: number[] } {
  const f = p.turn % 2 === 1 ? squareOf(field) : field;
  const rng = makeRng(seed);
  const gap = minStarGap(u, field.s);
  const clear = lineClearance(u, field.s);
  const stars: Placed[] = [];
  const figureStars: number[] = [];
  p.stars.forEach(([nx, ny], i) => {
    figureStars.push(stars.length);
    stars.push({ x: f.x + nx * f.w, y: f.y + ny * f.h, r: FIGURE_STAR_R * u, twinkle: rng() * TAU, fig: i });
  });

  const segs = p.edges.map(([a, b]) => [stars[figureStars[a]], stars[figureStars[b]]] as const);
  const want = Math.min(p.distractors, Math.max(0, capacity(field, u) - stars.length));
  const edge = 6 * u;
  for (let guard = 0; stars.length < p.stars.length + want && guard < 9000; guard++) {
    let x: number, y: number;
    if (rng() < p.crowd && figureStars.length) {
      const host = stars[figureStars[Math.floor(rng() * figureStars.length)]];
      const a = rng() * TAU, rr = gap * (1 + rng() * 0.9);
      x = host.x + Math.cos(a) * rr;
      y = host.y + Math.sin(a) * rr;
    } else {
      x = field.x + (0.04 + rng() * 0.92) * field.w;
      y = field.y + (0.04 + rng() * 0.92) * field.h;
    }
    if (x < field.x + edge || x > field.x + field.w - edge) continue;
    if (y < field.y + edge || y > field.y + field.h - edge) continue;
    const q = { x, y };
    if (stars.some(s => dist(s, q) < gap)) continue;
    if (segs.some(([a, b]) => pointSegment(q, a, b).d < clear)) continue;
    stars.push({ x, y, r: (3.4 + rng() * 1.4) * u, twinkle: rng() * TAU, fig: null });
  }
  return { stars, figureStars };
}

/** The smallest distance between any two of these stars: what the fingertip rule is checked against. */
export function closestPair(stars: ReadonlyArray<{ x: number; y: number }>): number {
  let worst = Infinity;
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) worst = Math.min(worst, dist(stars[i], stars[j]));
  }
  return worst;
}
