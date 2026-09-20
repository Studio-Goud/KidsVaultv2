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
  /** Millstream's village: what you have earned, what you have built, what each valley has paid */
  mill: { grain: number; built: string[]; paid: Record<string, number> };
}

const KEY = 'cloudhopper.save.v1';
const LEGACY_KEY = 'wolkenhaven.save.v2';

const defaults = (): SaveData => ({
  levels: {}, sound: true, radio: true, music: true, haptics: true, lang: 'auto', tutorialSeen: false,
  coins: 0, upgrades: {}, levelsPlayed: 0, lastAdAt: 0, totalLanded: 0, wxOpen: false,
  mill: { grain: 0, built: [], paid: {} },
});

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
    if (!raw) return defaults();
    const d = defaults();
    const got = JSON.parse(raw) as Partial<SaveData>;
    // a save written before the village existed has no mill slice, and a half-written one may be
    // missing a field inside it, so it is filled in rather than trusted whole
    return { ...d, ...got, mill: { ...d.mill, ...(got.mill ?? {}) } };
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
