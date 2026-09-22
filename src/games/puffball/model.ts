/**
 * Stuifzwam: the board, the rules, and what the game is actually teaching.
 *
 * The shape of it is Bomberman's, because that shape is good: a grid, something you put down that
 * goes off after a moment, a cross of effect, walls you cannot pass and pots you can clear, and the
 * hard part being that you have to be somewhere else when it happens.
 *
 * What it practises is the number line, stood on rather than written down. A puffball reaches a
 * fixed number of squares, and that number is shown on it. To be safe a child has to count the
 * squares between themselves and it, and compare two numbers: how far it reaches, and how far away
 * they are. Pick-ups raise the reach, so the comparison changes and has to be made again. Nothing
 * is phrased as arithmetic and there is no sum anywhere on the screen.
 *
 * Nobody is hurt in it. A puff knocks you over and you sit down dizzy for a moment, and the moles
 * do the same. That is deliberate for the age this is aimed at, and it costs the game nothing: the
 * tension is in the timing, not in the harm.
 */

import { makeRng } from '../../util/rng';

export type Tile = 'floor' | 'wall' | 'pot';
export type PickupKind = 'reach' | 'extra' | 'boots';

export interface Level {
  id: string;
  name: string;
  nameNl: string;
  cols: number;
  rows: number;
  seed: number;
  /** how thickly the open floor is seeded with pots, 0..1 */
  pots: number;
  /** how far the first puffball reaches */
  reach: number;
  /** how many puffballs may be out at once */
  puffs: number;
  /** how many moles wander the board */
  moles: number;
  /** squares a mole crosses per second */
  moleSpeed: number;
  /** what finishes the level */
  goal: 'clear' | 'moles';
  /** pick-ups hidden under the pots */
  hidden: PickupKind[];
  hint: string;
  hintNl: string;
}

/**
 * Eight nights. The first has nothing in it that can catch you, so the only thing to learn is that
 * a puffball reaches one square and you have to be off it. Each one after adds a single idea.
 */
export const LEVELS: Level[] = [
  {
    id: 'firstpuff', name: 'The first puff', nameNl: 'De eerste plof',
    cols: 9, rows: 9, seed: 5, pots: 0.5, reach: 1, puffs: 1, moles: 0, moleSpeed: 0, goal: 'clear',
    hidden: [],
    hint: 'Put a puffball next to a pot, then step away. It reaches one square.',
    hintNl: 'Zet een stuifzwam naast een pot en stap weg. Hij komt een vakje ver.',
  },
  {
    id: 'twosquares', name: 'Two squares', nameNl: 'Twee vakjes',
    cols: 9, rows: 9, seed: 17, pots: 0.55, reach: 2, puffs: 1, moles: 0, moleSpeed: 0, goal: 'clear',
    hidden: [],
    hint: 'This one reaches two. Count the squares before you stand still.',
    hintNl: 'Deze komt twee ver. Tel de vakjes voor je stil gaat staan.',
  },
  {
    id: 'cornerwise', name: 'Round the corner', nameNl: 'Om de hoek',
    cols: 11, rows: 9, seed: 29, pots: 0.46, reach: 2, puffs: 2, moles: 0, moleSpeed: 0, goal: 'clear',
    hidden: ['reach'],
    hint: 'Spores go straight, never round a corner. Behind a pillar you are safe.',
    hintNl: 'Sporen gaan rechtdoor, nooit om een hoek. Achter een pilaar sta je veilig.',
  },
  {
    id: 'themole', name: 'The mole', nameNl: 'De mol',
    cols: 11, rows: 9, seed: 41, pots: 0.42, reach: 2, puffs: 2, moles: 1, moleSpeed: 1.6, goal: 'moles',
    hidden: ['reach', 'extra'],
    hint: 'A mole runs away from a swelling puffball. Leave it nowhere to run to.',
    hintNl: 'Een mol rent weg van een zwellende stuifzwam. Zorg dat hij nergens heen kan.',
  },
  {
    id: 'pickitup', name: 'Pick it up', nameNl: 'Raap maar op',
    cols: 11, rows: 11, seed: 53, pots: 0.48, reach: 1, puffs: 2, moles: 1, moleSpeed: 1.6, goal: 'moles',
    hidden: ['reach', 'reach', 'extra', 'boots'],
    hint: 'Under some pots is something that makes your puffball reach further. Count again after you take it.',
    hintNl: 'Onder sommige potten ligt iets waardoor je stuifzwam verder komt. Tel daarna opnieuw.',
  },
  {
    id: 'twomoles', name: 'Two moles', nameNl: 'Twee mollen',
    cols: 11, rows: 11, seed: 67, pots: 0.44, reach: 2, puffs: 2, moles: 2, moleSpeed: 2, goal: 'moles',
    hidden: ['reach', 'extra', 'boots'],
    hint: 'Two of them now. Leave yourself a way out before you put one down.',
    hintNl: 'Nu met zijn tweeen. Zorg dat je weg kunt voor je er een neerzet.',
  },
  {
    id: 'thewarren', name: 'The warren', nameNl: 'Het hol',
    cols: 13, rows: 11, seed: 83, pots: 0.52, reach: 2, puffs: 3, moles: 2, moleSpeed: 2.3, goal: 'moles',
    hidden: ['reach', 'reach', 'extra', 'boots'],
    hint: 'A big board and quicker moles. A puff can set off another puff.',
    hintNl: 'Een groot veld en snellere mollen. Een plof kan een andere plof aanzetten.',
  },
  {
    id: 'bramblenight', name: 'Bramble night', nameNl: 'Braamnacht',
    cols: 13, rows: 11, seed: 97, pots: 0.5, reach: 3, puffs: 3, moles: 3, moleSpeed: 2.5, goal: 'moles',
    hidden: ['reach', 'extra', 'boots', 'boots'],
    hint: 'Everything at once. Breathe, count, then move.',
    hintNl: 'Alles tegelijk. Adem, tel, en dan pas lopen.',
  },
];

export interface Board {
  cols: number;
  rows: number;
  tiles: Tile[];
  /** what is under each pot, where anything is */
  under: (PickupKind | null)[];
}

export const at = (b: Board, x: number, y: number): Tile =>
  (x < 0 || y < 0 || x >= b.cols || y >= b.rows) ? 'wall' : b.tiles[y * b.cols + x];

export const setTile = (b: Board, x: number, y: number, t: Tile): void => { b.tiles[y * b.cols + x] = t; };

/**
 * Where the player starts, and where the moles start: opposite corners, kept clear. Three corners
 * are all there are, so a level asking for more than three moles would silently get three.
 */
export const START = { x: 1, y: 1 };
export const MAX_MOLES = 3;
export const moleStarts = (b: Board): Array<{ x: number; y: number }> => [
  { x: b.cols - 2, y: b.rows - 2 },
  { x: b.cols - 2, y: 1 },
  { x: 1, y: b.rows - 2 },
];

/**
 * Lay out a board: a wall around the edge, a pillar on every second square, and pots scattered over
 * what is left. The corners everybody starts in are cleared, along with the squares beside them, so
 * nobody is walled in before the game begins.
 */
export function buildBoard(level: Level): Board {
  const { cols, rows } = level;
  const b: Board = {
    cols, rows,
    tiles: new Array<Tile>(cols * rows).fill('floor'),
    under: new Array<PickupKind | null>(cols * rows).fill(null),
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const edge = x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      const pillar = x % 2 === 0 && y % 2 === 0;
      if (edge || pillar) setTile(b, x, y, 'wall');
    }
  }
  const rng = makeRng(level.seed * 7919 + 11);
  const keep = new Set<string>();
  for (const s of [START, ...moleStarts(b)]) {
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) {
      keep.add(`${s.x + dx},${s.y + dy}`);
    }
  }
  const potCells: number[] = [];
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (at(b, x, y) !== 'floor') continue;
      if (keep.has(`${x},${y}`)) continue;
      if (rng() > level.pots) continue;
      setTile(b, x, y, 'pot');
      potCells.push(y * cols + x);
    }
  }
  // The pick-ups go under pots spread across the board rather than clustered in one corner.
  // A shuffle by sort comparator is not a shuffle - it leans on whatever order the sort happens
  // to visit - so this swaps properly, and then takes evenly spaced pots out of the result.
  const order = potCells.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  level.hidden.forEach((kind, i) => {
    const cell = order[Math.floor((i / Math.max(1, level.hidden.length)) * order.length)];
    if (cell !== undefined && b.under[cell] === null) b.under[cell] = kind;
  });
  return b;
}

export const potsLeft = (b: Board): number => b.tiles.reduce((n, t) => n + (t === 'pot' ? 1 : 0), 0);

export interface Puff {
  x: number;
  y: number;
  /** seconds until it pops */
  fuse: number;
  reach: number;
  /** true for the player's own, false for a mole's */
  mine: boolean;
}

/**
 * Which squares a puffball will cover. Spores go in straight lines and stop at a wall; they take a
 * pot with them and stop there too, which is the rule that makes a pillar a place to hide.
 *
 * This is also what the game draws while the puffball swells, so a child can count the squares
 * before anything happens rather than after.
 */
export function reachOf(b: Board, p: { x: number; y: number; reach: number }): Array<{ x: number; y: number; step: number }> {
  const out = [{ x: p.x, y: p.y, step: 0 }];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let i = 1; i <= p.reach; i++) {
      const nx = p.x + dx * i, ny = p.y + dy * i;
      const t = at(b, nx, ny);
      if (t === 'wall') break;
      out.push({ x: nx, y: ny, step: i });
      if (t === 'pot') break;
    }
  }
  return out;
}

export const FUSE = 2.6;
export const POP_TIME = 0.55;

/** Stars: everything finished, and finished without being knocked over. */
export function starsFor(knocks: number, left: number): number {
  if (left > 0) return 0;
  if (knocks === 0) return 3;
  if (knocks <= 1) return 2;
  return 1;
}
