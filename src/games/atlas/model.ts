/**
 * Wereldatlas: the ladder, and what each rung asks for.
 *
 * The ladder starts where a Dutch child is standing and works outward - the twelve provinces, the
 * water that decides where the country is, the cities, the neighbours, Europe, the world - which
 * is the order a child's own map actually grows in. Nothing here draws anything: a level is a
 * board to put pieces on and a list of pieces, and everything else falls out of `geo.ts`.
 *
 * One rule runs through all nine: a piece dropped in the wrong place is never a loss. It springs
 * back, the map says where the thing really was and why it is worth knowing, and then the piece
 * goes home by itself. The stars only ever count what went home first time.
 */

import { makeRng } from '../../util/rng';
import {
  CONTINENTS, EU_COUNTRIES, EU_VIEW, FLAG_COUNTRIES, NEAR_VIEW, NEIGHBOURS, NL_CITIES,
  NL_VIEW, NL_WATERS, OCEANS, PROVINCES, WORLD_COUNTRIES, WORLD_VIEW,
  type Feature, type Pt, type View, missDistance, spanOf,
} from './geo';

/** What a piece is, which decides how it is drawn in the hand and how it is checked. */
export type PieceKind = 'shape' | 'pin' | 'line' | 'name' | 'flag';

export type BoardId = 'nl' | 'near' | 'eu' | 'world';

export interface Level {
  id: string;
  name: string;
  nameNl: string;
  board: BoardId;
  piece: PieceKind;
  /** how many pieces this level hands over */
  rounds: number;
  /** the dyke switch and the height map, which only the water level has */
  dykes?: boolean;
  hint: string;
  hintNl: string;
}

export const LEVELS: Level[] = [
  {
    id: 'provincies', name: 'The Netherlands: the provinces', nameNl: 'Nederland: de provincies',
    board: 'nl', piece: 'shape', rounds: 12,
    hint: 'Twelve provinces. Take one and drop it where it belongs.',
    hintNl: 'Twaalf provincies. Pak er een en laat hem los waar hij hoort.',
  },
  {
    id: 'water', name: 'The Netherlands: the water', nameNl: 'Nederland: het water',
    board: 'nl', piece: 'line', rounds: 8, dykes: true,
    hint: 'The rivers, the big water and the works that keep the sea out. Switch the dykes off to see why.',
    hintNl: 'De rivieren, het grote water en wat de zee buiten houdt. Zet de dijken uit om te zien waarom.',
  },
  {
    id: 'steden', name: 'The Netherlands: the cities', nameNl: 'Nederland: de steden',
    board: 'nl', piece: 'pin', rounds: 10,
    hint: 'Put the pin on the spot. Near enough is good enough.',
    hintNl: 'Zet de speld op de plek. Dichtbij genoeg is goed genoeg.',
  },
  {
    id: 'buren', name: 'The neighbours', nameNl: 'De buren',
    board: 'near', piece: 'shape', rounds: 5,
    hint: 'Who lives next door, and which sea is in the way.',
    hintNl: 'Wie er naast ons wonen, en welke zee ertussen ligt.',
  },
  {
    id: 'europa', name: 'Europe: the countries', nameNl: 'Europa: de landen',
    board: 'eu', piece: 'shape', rounds: 12,
    hint: 'A country by its shape. Look at the coast first.',
    hintNl: 'Een land aan zijn vorm. Kijk eerst naar de kust.',
  },
  {
    id: 'hoofdsteden', name: 'Europe: the capitals', nameNl: 'Europa: de hoofdsteden',
    board: 'eu', piece: 'name', rounds: 10,
    hint: 'Drag the capital onto the country it belongs to.',
    hintNl: 'Sleep de hoofdstad naar het land waar hij bij hoort.',
  },
  {
    id: 'werelddelen', name: 'The world: continents and oceans', nameNl: 'De wereld: werelddelen en oceanen',
    board: 'world', piece: 'shape', rounds: 12,
    hint: 'Seven continents and five oceans. Between them they are the whole earth.',
    hintNl: 'Zeven werelddelen en vijf oceanen. Samen zijn ze de hele aarde.',
  },
  {
    id: 'wereldlanden', name: 'The world: the countries', nameNl: 'De wereld: de landen',
    board: 'world', piece: 'shape', rounds: 12,
    hint: 'The big ones, and the ones you hear about.',
    hintNl: 'De grote landen, en de landen waar je over hoort.',
  },
  {
    id: 'vlaggen', name: 'Flags', nameNl: 'Vlaggen',
    board: 'eu', piece: 'flag', rounds: 10,
    hint: 'Whose flag is this? Drop it on the country.',
    hintNl: 'Van wie is deze vlag? Laat hem los op het land.',
  },
];

export const levelById = (id: string): Level | undefined => LEVELS.find(l => l.id === id);

/**
 * What a particular piece looks like in the hand.
 *
 * Usually the level says, but an ocean is the exception: it has no shape worth learning, it wraps
 * round the back of the map so its outline is two halves at opposite edges, and what a child is
 * actually being asked is where the name goes. So an ocean is a name, whatever the level is.
 */
export function pieceKindFor(level: Level, f: Feature): PieceKind {
  return f.kind === 'ocean' ? 'name' : level.piece;
}

export const VIEWS: Record<BoardId, View> = {
  nl: NL_VIEW, near: NEAR_VIEW, eu: EU_VIEW, world: WORLD_VIEW,
};

/**
 * How close a drop has to be, in degrees, when the target is a point or a line rather than an area.
 *
 * A city on the map of the Netherlands is a dot; asking a five year old to hit it exactly would be
 * asking them to be accurate to about four kilometres. The world board is twenty times wider, so
 * the same forgiveness in degrees would be no forgiveness at all - hence one number per board.
 *
 * Every one of these is worth about the same number of millimetres under the finger on a phone,
 * which is the only measure that matters: a map of the world on a 320 pixel screen is drawn at
 * roughly one pixel to the degree, so fourteen degrees is fourteen pixels, and a map of the
 * Netherlands is drawn at eighty, so a fifth of a degree is eighteen.
 */
export const NEAR: Record<BoardId, number> = { nl: 0.22, near: 0.45, eu: 2.2, world: 14 };

/**
 * How small a target may be and still be worth handing a child, in the degrees the board is drawn
 * in.
 *
 * Luxembourg on a map of Europe that fits a phone is four pixels across. It stays on the board and
 * it stays in the data - it is a real country with a real capital and three real languages - but
 * it is not something anybody can be asked to hit with a finger, so it is never dealt out as a
 * piece. The map of the Netherlands has no such problem: the smallest province on it is Utrecht,
 * and Utrecht is enormous.
 *
 * The world is the strict one. A map of the whole earth on a 320 pixel screen is about one pixel
 * to the degree, so a country has to be twelve degrees across before it is a target a finger can
 * find - and the one before it, at seven, made the level a game of hitting Kenya between Ethiopia
 * and Congo with a fingertip eight pixels wide. Twelve leaves thirty-three countries, which is
 * three times what the level deals, and it is the level that says "the big ones" on its own card.
 */
export const MIN_SPAN: Record<BoardId, number> = { nl: 0, near: 0.35, eu: 2.0, world: 12 };

/**
 * Can this level outline its empty places?
 *
 * Only where the piece has a shape or a spot of its own: a province, a country, a continent, a
 * city. On the water level the piece is a river, on the capitals level it is a name and on the
 * flags level it is a flag - and in all three the places a piece can go are countries and
 * provinces the board has already drawn, so there is nothing left for an outline to show. The
 * switch is hidden there rather than left to do nothing.
 */
export function outlinable(level: Level): boolean {
  return level.piece === 'shape' || level.piece === 'pin';
}

/** Is this target big enough to be dragged onto on this board? */
export function placeable(level: Level, f: Feature): boolean {
  return spanOf(f, VIEWS[level.board].kx) >= MIN_SPAN[level.board];
}

/** Everything this level can hand over as a piece. */
export function poolFor(level: Level): Feature[] {
  return rawPool(level).filter(f => placeable(level, f));
}

function rawPool(level: Level): Feature[] {
  switch (level.id) {
    case 'provincies': return PROVINCES;
    case 'water': return NL_WATERS;
    case 'steden': return NL_CITIES;
    case 'buren': return NEIGHBOURS;
    case 'europa': return EU_COUNTRIES;
    case 'hoofdsteden': return EU_COUNTRIES.filter(c => c.capNl);
    case 'werelddelen': return [...CONTINENTS, ...OCEANS];
    case 'wereldlanden': return WORLD_COUNTRIES;
    case 'vlaggen': return FLAG_COUNTRIES
      .map(id => EU_COUNTRIES.find(c => c.id === id))
      .filter((f): f is Feature => !!f && !!f.flag);
    default: return [];
  }
}

/** What is drawn under the pieces: the map the level is played on. */
export function boardFor(level: Level): Feature[] {
  switch (level.board) {
    case 'nl': return PROVINCES;
    // the Netherlands is one of the pieces here too: the first thing to find on a map of the
    // neighbours is where you are standing yourself
    case 'near': return NEIGHBOURS.filter(f => f.kind === 'country');
    case 'eu': return EU_COUNTRIES;
    case 'world': return CONTINENTS;
    default: return [];
  }
}

export const rngFor = (level: Level, attempt: number): (() => number) =>
  makeRng(level.id.length * 8171 + attempt * 131 + 29);

export function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/**
 * The pieces for one go at a level, in the order they are handed over.
 *
 * A level with more in its pool than it has rounds takes a different handful each time, so playing
 * Europe twice is not playing the same twelve countries twice. A level that asks for everything it
 * has - the twelve provinces - still shuffles, so the order is never learnt instead of the map.
 */
export function runFor(level: Level, rng: () => number): Feature[] {
  return shuffle(poolFor(level), rng).slice(0, Math.min(level.rounds, poolFor(level).length));
}

/**
 * What the finger actually landed on: the nearest thing this level deals in, or nothing.
 *
 * Nearest, rather than first, is the whole trick. Arnhem and Nijmegen are fifteen kilometres
 * apart and both are within a fingertip of each other on a phone; the Rijn and the Waal run side
 * by side across the middle of the country. Asking which is *nearer* answers both cases the way a
 * teacher would, and hands the correction its own words for free: "dat is Nijmegen, Arnhem ligt
 * hier".
 */
export function dropTarget(level: Level, p: Pt): Feature | null {
  const near = NEAR[level.board];
  const kx = VIEWS[level.board].kx;
  let best: Feature | null = null;
  let bestD = Infinity;
  let bestSpan = Infinity;
  for (const f of poolFor(level)) {
    const d = missDistance(f, p);
    if (d > near) continue;
    const span = spanOf(f, kx);
    // two shapes can both hold a point where a border is shared or an outline is coarse; the
    // smaller one is the more particular answer, so it wins
    if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && span < bestSpan)) {
      bestD = d; bestSpan = span; best = f;
    }
  }
  return best;
}

/** Is this where this piece goes? It is, when nothing this level knows about is nearer. */
export function isRight(level: Level, piece: Feature, p: Pt): boolean {
  return dropTarget(level, p)?.id === piece.id;
}

/**
 * Stars: what went home first time, before the map showed you.
 *
 * Being shown always counts as help, so three stars mean the map was known rather than guessed.
 * There is no way to fail: every piece ends up in its place, so finishing is finishing.
 */
export function starsFor(firstTry: number, total: number): number {
  if (total <= 0) return 0;
  const acc = firstTry / total;
  if (acc >= 0.95) return 3;
  if (acc >= 0.75) return 2;
  if (acc >= 0.5) return 1;
  return 0;
}

/** Which level comes after this one, or null at the top of the ladder. */
export function nextLevel(id: string): Level | null {
  const i = LEVELS.findIndex(l => l.id === id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1] : null;
}

/**
 * The level a wrong drop is turned into: what it really was, and where the child put it instead.
 *
 * "Dat is Drenthe. Friesland ligt hier" is worth far more than "fout", and it is the one moment in
 * the game where a child is looking straight at the map wanting to know.
 */
export function teachLine(want: Feature, got: Feature | null, nl: boolean): string {
  const wantName = nl ? want.nl : want.en;
  if (got && got.id !== want.id) {
    const gotName = nl ? got.nl : got.en;
    return nl ? `Dat is ${gotName}. ${wantName} ligt hier.` : `That is ${gotName}. ${wantName} is here.`;
  }
  return nl ? `${wantName} ligt hier.` : `${wantName} is here.`;
}

/**
 * The sea level the dyke switch runs between, in metres.
 *
 * Zero is an ordinary day with the dykes open, which already puts a quarter of the country under
 * water. Five is a storm surge, which is roughly what stood against the dykes in 1953.
 */
export const SEA_OFF = 0;
export const SEA_STORM = 5;
