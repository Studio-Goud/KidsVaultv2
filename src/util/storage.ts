export interface LevelProgress { best: number; stars: number; completed: boolean }
export interface SaveData {
  levels: Record<string, LevelProgress>;
  sound: boolean;
  radio: boolean;
  music: boolean;
  haptics: boolean;
  lang: 'nl' | 'en' | 'auto';
  tutorialSeen: boolean;
  coins: number;
  upgrades: Record<string, number>;
  levelsPlayed: number;
  lastAdAt: number;
  totalLanded: number;
  /** weather detail in the aircraft panel is folded out */
  wxOpen: boolean;
  /** the tower has pointed out the build button once */
  buildHintSeen: boolean;
  /** which games have shown themselves off once; the coach never teaches the same game twice */
  taught: string[];
  /** how firm the ground is under each skill, which is what decides how hard the next question is */
  skills: Record<string, { level: number; seen: number; streak: number; slump: number }>;
  /**
   * The same ground measured per subject, per game: `topics['numbers']['tafels']` is how firm the
   * tables of seven are. One number for "number" cannot hold both splitting ten and the tables.
   */
  topics: Record<string, Record<string, { level: number; seen: number; streak: number; slump: number }>>;
  /** Watermolen's village: what you have earned, what you have built, what each valley has paid */
  mill: { grain: number; built: string[]; paid: Record<string, number> };
  /** Moonshot: how far the best flight got, on the ladder and in kilometres, and the rocket on the pad */
  moon: { best: number; target: number; topKm: number; design: Array<{ id: string; col: number; row: number; delay?: number; hold?: string[] }> };
  /** Klokkijken: the 5, 10, 15 ring on the dial is switched on, for a child still counting in fives */
  clock: { minuteNumbers: boolean };
  /** The animal book: which animals have been looked at, and how tall the child is on the size bar */
  animals: { seen: number[]; childCm: number };
  /** Wereldatlas: the empty places on the board are outlined, for a child still finding the holes */
  atlas: { outlines: boolean };
  /** Rekenrijk: every object on the table wears its number, for a child still counting one by one */
  numbers: { countOn: boolean };
  /** Letterbos: the word is written above the boxes, for a child who still wants to copy it */
  letters: { spell: boolean };
  /**
   * Klankhuis: the tune the child wrote in the sequencer, which instrument plays it and how fast.
   * `steps` is one small number per step of the grid, a bit per chime - see `music.ts`. It is
   * sanitised on the way out rather than trusted, because a corrupt save may not stop the game
   * opening.
   */
  rhythm: { steps: number[]; voice: string; tempo: number };
  /**
   * Stroomkring: which puzzles have come out, which one is open, and the circuit left on the
   * workbench. The board is plain data written by the game and read back by `cleanCircuit()`,
   * which throws the lot away rather than opening a bench that cannot be solved.
   */
  circuit: {
    solved: string[];
    puzzle: number;
    bench: Array<{ id: string; col: number; row: number; rot: number; on?: boolean; blown?: boolean; charge?: number; link?: number }>;
  };
}

const KEY = 'cloudhopper.save.v1';
const LEGACY_KEY = 'wolkenhaven.save.v2';

const defaults = (): SaveData => ({
  levels: {}, sound: true, radio: true, music: true, haptics: true, lang: 'auto', tutorialSeen: false,
  coins: 0, upgrades: {}, levelsPlayed: 0, lastAdAt: 0, totalLanded: 0, wxOpen: false, buildHintSeen: false,
  taught: [], skills: {}, topics: {},
  mill: { grain: 0, built: [], paid: {} },
  moon: { best: 0, target: 7, topKm: 0, design: [] },
  clock: { minuteNumbers: false },
  animals: { seen: [], childCm: 120 },
  atlas: { outlines: true },
  numbers: { countOn: false },
  letters: { spell: false },
  rhythm: { steps: [0, 0, 0, 0, 0, 0, 0, 0], voice: 'chime', tempo: 100 },
  circuit: { solved: [], puzzle: 0, bench: [] },
});

/**
 * Stroomkring's slice, out of a file somebody could have typed.
 *
 * The board itself is checked by `cleanCircuit()` in the game, which throws the lot away rather
 * than opening a bench that cannot be solved. What is checked here is the rest of the slice: a
 * list of finished puzzles that is not a list would be read a letter at a time, and the game would
 * open saying eight of nine were done.
 */
function circuitSlice(d: SaveData['circuit'], got: unknown): SaveData['circuit'] {
  const o = (got ?? {}) as Partial<SaveData['circuit']>;
  return {
    solved: Array.isArray(o.solved) ? o.solved.filter((x): x is string => typeof x === 'string') : d.solved,
    puzzle: typeof o.puzzle === 'number' && isFinite(o.puzzle) ? o.puzzle : d.puzzle,
    bench: Array.isArray(o.bench) ? o.bench : d.bench,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return defaults();
    const d = defaults();
    const got = JSON.parse(raw) as Partial<SaveData>;
    // a save written before the village existed has no mill slice, and a half-written one may be
    // missing a field inside it, so it is filled in rather than trusted whole
    return {
      ...d, ...got,
      mill: { ...d.mill, ...(got.mill ?? {}) },
      moon: { ...d.moon, ...(got.moon ?? {}) },
      clock: { ...d.clock, ...(got.clock ?? {}) },
      animals: { ...d.animals, ...(got.animals ?? {}) },
      atlas: { ...d.atlas, ...(got.atlas ?? {}) },
      numbers: { ...d.numbers, ...(got.numbers ?? {}) },
      letters: { ...d.letters, ...(got.letters ?? {}) },
      rhythm: { ...d.rhythm, ...(got.rhythm ?? {}) },
      circuit: circuitSlice(d.circuit, got.circuit),
    };
  } catch { return defaults(); }
}

export function writeSave(data: SaveData): void {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode */ }
}

export const save: SaveData = loadSave();
export const persist = (): void => writeSave(save);

export function levelProgress(id: string): LevelProgress {
  return save.levels[id] ?? { best: 0, stars: 0, completed: false };
}
export function recordLevelResult(id: string, landed: number, stars: number, completed: boolean): LevelProgress {
  const cur = levelProgress(id);
  const next: LevelProgress = {
    best: Math.max(cur.best, landed),
    stars: Math.max(cur.stars, stars),
    completed: cur.completed || completed,
  };
  save.levels[id] = next;
  persist();
  return next;
}

export const realId = (portId: string, step: number): string => `real:${portId}:${step}`;

export function addCoins(n: number): void { save.coins = Math.max(0, Math.round(save.coins + n)); persist(); }
export function upgradeLevel(id: string): number { return save.upgrades[id] ?? 0; }
