import { LEVELS } from './levels';
import type { LevelDef, TimeOfDay } from './types';
import { levelProgress } from '../util/storage';
import { lang } from '../i18n';
import { makeScript, type WeatherProfile } from './weather';
import { REAL_PORTS, type RealPort } from './realports';
import { realId } from '../util/storage';

export const LEVELS_PER_WORLD = 8;
export const WORLDS = LEVELS; // each island is a world with 8 missions

export type MissionTag = 'calm' | 'busy' | 'storm' | 'night' | 'heavies' | 'rush' | 'dusk' | 'golden';

const TAG_NAMES: Record<MissionTag, [string, string]> = {
  calm: ['Rustig', 'Calm'], busy: ['Drukte', 'Busy'], storm: ['Storm', 'Storm'], night: ['Nacht', 'Night'],
  heavies: ['Zware jongens', 'Heavies'], rush: ['Spitsuur', 'Rush hour'], dusk: ['Schemering', 'Twilight'], golden: ['Gouden uur', 'Golden hour'],
};

export const missionId = (worldId: string, index: number): string => `${worldId}:${index}`;

const TIMES: TimeOfDay[] = ['morning', 'golden', 'dusk', 'night'];

type Pool = Array<{ type: string; weight: number }>;

/**
 * The real-world fleet, introduced gradually. Each world lists the aircraft that may appear,
 * with the mission index from which they are unlocked and their spawn weight.
 */
const FLEET: Array<Array<{ type: string; from: number; weight: number }>> = [
  // 0 Lindeneiland: short strip, light aircraft only
  [
    { type: 'c172', from: 0, weight: 3 }, { type: 'pa28', from: 0, weight: 2 }, { type: 'da40', from: 1, weight: 2 },
    { type: 'dhc6', from: 2, weight: 2 }, { type: 'sr22', from: 3, weight: 2 }, { type: 'bonanza', from: 4, weight: 1 },
    { type: 'c208', from: 4, weight: 2 }, { type: 'pc12', from: 5, weight: 2 }, { type: 'kingair', from: 6, weight: 2 },
  ],
  // 1 Vuurtorenbaai: long runway, turboprops and regionals
  [
    { type: 'c172', from: 0, weight: 1 }, { type: 'dhc6', from: 0, weight: 1 }, { type: 'kingair', from: 0, weight: 2 },
    { type: 'atr72', from: 0, weight: 3 }, { type: 'q400', from: 1, weight: 2 }, { type: 'pc12', from: 1, weight: 1 },
    { type: 'e175', from: 2, weight: 2 }, { type: 'crj900', from: 3, weight: 2 }, { type: 'citation', from: 3, weight: 1 },
    { type: 'a320', from: 5, weight: 2 }, { type: 'b737', from: 6, weight: 2 }, { type: 'b787', from: 7, weight: 2 },
  ],
  // 2 Molenrif: crosswind, narrowbodies
  [
    { type: 'dhc6', from: 0, weight: 1 }, { type: 'atr72', from: 0, weight: 2 }, { type: 'e195', from: 0, weight: 2 },
    { type: 'a320', from: 0, weight: 3 }, { type: 'b737', from: 1, weight: 3 }, { type: 'q400', from: 1, weight: 1 },
    { type: 'a321', from: 3, weight: 2 }, { type: 'g650', from: 3, weight: 1 }, { type: 'b757', from: 4, weight: 2 },
    { type: 'b787', from: 5, weight: 2 }, { type: 'b747', from: 7, weight: 2 }, { type: 'a350', from: 7, weight: 1 },
  ],
  // 3 Tweelingzusters: short + long, the widebodies arrive, first military transport
  [
    { type: 'c172', from: 0, weight: 2 }, { type: 'kingair', from: 0, weight: 2 }, { type: 'atr72', from: 0, weight: 2 },
    { type: 'e175', from: 0, weight: 1 }, { type: 'a320', from: 0, weight: 2 }, { type: 'b737', from: 1, weight: 2 },
    { type: 'b787', from: 1, weight: 2 }, { type: 'a350', from: 2, weight: 2 }, { type: 'b777', from: 3, weight: 2 },
    { type: 'b747', from: 4, weight: 2 }, { type: 'c130', from: 5, weight: 1 }, { type: 'a380', from: 7, weight: 1 },
  ],
  // 4 Zeemeerminlagune: seaplanes, heavies and the first fighters
  [
    { type: 'c208a', from: 0, weight: 3 }, { type: 'icona5', from: 0, weight: 2 }, { type: 'dhc6f', from: 1, weight: 2 },
    { type: 'atr72', from: 0, weight: 1 }, { type: 'a320', from: 0, weight: 2 }, { type: 'e195', from: 0, weight: 1 },
    { type: 'a330', from: 2, weight: 2 }, { type: 'b787', from: 2, weight: 1 }, { type: 'b747', from: 3, weight: 1 },
    { type: 'p8', from: 4, weight: 1 }, { type: 'f16', from: 5, weight: 1 }, { type: 'a400m', from: 6, weight: 1 },
  ],
  // 5 Sterrenhaven: everything, helicopters, all military
  [
    { type: 'h135', from: 0, weight: 2 }, { type: 'r44', from: 0, weight: 1 }, { type: 'aw139', from: 1, weight: 1 },
    { type: 'c172', from: 0, weight: 1 }, { type: 'q400', from: 0, weight: 1 }, { type: 'e195', from: 0, weight: 1 },
    { type: 'a321', from: 0, weight: 2 }, { type: 'b777', from: 1, weight: 1 }, { type: 's92', from: 2, weight: 1 },
    { type: 'b747', from: 2, weight: 1 }, { type: 'f16', from: 2, weight: 1 }, { type: 'c130', from: 3, weight: 1 },
    { type: 'chinook', from: 3, weight: 1 }, { type: 'eurofighter', from: 4, weight: 1 }, { type: 'nh90', from: 5, weight: 1 },
    { type: 'f35', from: 6, weight: 1 }, { type: 'a380', from: 6, weight: 1 }, { type: 'a400m', from: 7, weight: 1 },
  ],
];

function poolFor(worldIndex: number, index: number, tag: MissionTag): Pool {
  const pool: Pool = FLEET[worldIndex].filter(f => f.from <= index).map(f => ({ type: f.type, weight: f.weight }));
  if (tag === 'heavies') for (const p of pool) if (['b747', 'a380', 'b777', 'a350', 'a330', 'b787', 'c130', 'a400m'].includes(p.type)) p.weight *= 3;
  return pool.length ? pool : [{ type: 'c172', weight: 1 }];
}

/** Build mission `index` (0-based) of a world by scaling the island's base definition. */
export function buildMission(worldIndex: number, index: number): LevelDef & { tag: MissionTag; index: number; worldIndex: number } {
  const base = WORLDS[worldIndex];
  const i = index;
  const tagOrder: MissionTag[] = ['calm', 'busy', 'golden', 'storm', 'dusk', 'heavies', 'night', 'rush'];
  const tag = tagOrder[i];
  const time: TimeOfDay = tag === 'night' ? 'night' : tag === 'dusk' ? 'dusk' : tag === 'golden' ? 'golden' : tag === 'storm' ? 'morning' : i % 2 === 0 ? base.time : TIMES[(worldIndex + i) % 4];
  const goal = Math.round(base.goal * (0.75 + i * 0.09));
  const s = base.spawn;
  const spawn = {
    first: 1.2,
    base: Math.max(6, s.base - i * 0.5 - (tag === 'rush' ? 2 : 0)),
    min: Math.max(3.8, s.min - i * 0.25),
    step: s.step,
    maxConcurrent: s.maxConcurrent + (tag === 'busy' || tag === 'rush' ? 1 : 0),
    maxConcurrentEnd: s.maxConcurrentEnd + (tag === 'rush' ? 2 : i >= 5 ? 1 : 0),
  };
  const wind = base.wind
    ? { ...base.wind, kmh: Math.round(base.wind.kmh * (0.55 + i * 0.09) * (tag === 'storm' ? 1.7 : 1)), gust: Math.round(base.wind.gust * (tag === 'storm' ? 2.2 : 1)), wander: base.wind.wander * (tag === 'storm' ? 1.6 : 1) }
    : (tag === 'storm' ? { kmh: 14, gust: 8, dirDeg: 100 + worldIndex * 40, wander: 20 } : null);
  const tagName = TAG_NAMES[tag][lang() === 'nl' ? 0 : 1];
  const profile: Record<MissionTag, WeatherProfile> = { calm: 'clear', busy: 'breezy', golden: 'heat', storm: 'storm', dusk: 'fog', heavies: 'showers', night: 'icing', rush: 'front' };
  // early worlds keep the weather gentle
  const prof: WeatherProfile = worldIndex === 0 && (tag === 'storm' || tag === 'night') ? (tag === 'storm' ? 'gusty' : 'breezy') : worldIndex === 0 && tag === 'dusk' ? 'clear' : profile[tag];
  const weather = makeScript(prof, worldIndex, wind, time === 'night');
  return {
    ...base,
    weather,
    id: missionId(base.id, i),
    name: `${base.name} ${i + 1}`,
    subtitle: tagName, subtitleEn: TAG_NAMES[tag][1],
    time, goal, planes: poolFor(worldIndex, i, tag), spawn, wind,
    clouds: base.clouds + (tag === 'storm' ? 4 : 0),
    seed: base.seed,
    tag, index: i, worldIndex,
    twinRunway: base.runways.some(r => r.kind === 'long'),
    twinClosed: i < 5,
  };
}

/** All aircraft that can appear on a world (for the island card). */
export function fleetOf(worldIndex: number): string[] { return FLEET[worldIndex].map(f => f.type); }
/** First world (and mission) in which a type appears, for the fleet gallery. */
export function firstAppearance(typeId: string): { worldIndex: number; index: number } | null {
  for (let w = 0; w < FLEET.length; w++) { const f = FLEET[w].find(x => x.type === typeId); if (f) return { worldIndex: w, index: f.from }; }
  return null;
}

export function worldStars(worldIndex: number): number {
  let s = 0;
  for (let i = 0; i < LEVELS_PER_WORLD; i++) s += levelProgress(missionId(WORLDS[worldIndex].id, i)).stars;
  return s;
}
export function totalStars(): number {
  let s = 0;
  for (let w = 0; w < WORLDS.length; w++) s += worldStars(w);
  return s;
}

/** Stars earned at one real-world airport (4 missions, 3 stars each). */
export function portStars(portId: string): number {
  let s = 0;
  for (let k = 0; k < 4; k++) s += levelProgress(realId(portId, k)).stars;
  return s;
}
export function realStars(): number {
  let s = 0;
  for (const p of REAL_PORTS) s += portStars(p.id);
  return s;
}
/** Every star in the game: islands plus real airports. */
export function grandTotalStars(): number { return totalStars() + realStars(); }
export const MAX_STARS = WORLDS.length * LEVELS_PER_WORLD * 3 + REAL_PORTS.length * 4 * 3;

/**
 * One journey, not two menus.
 *
 * The islands and the real airports used to be separate modes on the title screen, which made a
 * child choose between two things before knowing what either was. They are one route now: every
 * island and every real field in a single order, sorted by the stars they ask for, so there is
 * always exactly one next place to go.
 */
export type Stop =
  | { kind: 'island'; world: number; needs: number }
  | { kind: 'port'; port: RealPort; needs: number };

export function route(): Stop[] {
  const stops: Stop[] = [];
  // an island asks for half the stars of the one before it, which is what worldUnlocked checks
  WORLDS.forEach((_, i) => stops.push({ kind: 'island', world: i, needs: i * 12 }));
  for (const p of REAL_PORTS) stops.push({ kind: 'port', port: p, needs: p.unlockAt });
  return stops.sort((a, b) => a.needs - b.needs || (a.kind === 'island' ? -1 : 1));
}

/** Is this stop open? Islands go by the island before them, fields by the stars in hand. */
export function stopOpen(s: Stop): boolean {
  return s.kind === 'island' ? worldUnlocked(s.world) : portUnlocked(s.port);
}

/** How many stars a locked stop is still short, for the line on its card. */
export function stopShort(s: Stop): number {
  if (s.kind === 'port') return Math.max(0, s.port.unlockAt - grandTotalStars());
  if (s.world === 0) return 0; // the first island is where the journey starts; it is never shut
  return Math.max(0, 12 - worldStars(s.world - 1));
}

/** The first stop that is open and not finished: where the journey is up to. */
export function routeNow(): number {
  const r = route();
  for (let i = 0; i < r.length; i++) {
    const s = r[i];
    if (!stopOpen(s)) continue;
    if (s.kind === 'island' && worldStars(s.world) < LEVELS_PER_WORLD * 3) return i;
    if (s.kind === 'port' && portStars(s.port.id) < 12) return i;
  }
  return 0;
}

export function portUnlocked(port: RealPort): boolean { return grandTotalStars() >= port.unlockAt; }
export function portMissionUnlocked(port: RealPort, step: number): boolean {
  if (!portUnlocked(port)) return false;
  if (step === 0) return true;
  return levelProgress(realId(port.id, step - 1)).completed;
}
/** A world unlocks once the previous world has at least 12 of 24 stars. */
export function worldUnlocked(worldIndex: number): boolean {
  if (worldIndex === 0) return true;
  return worldStars(worldIndex - 1) >= 12;
}
export function missionUnlocked(worldIndex: number, index: number): boolean {
  if (!worldUnlocked(worldIndex)) return false;
  if (index === 0) return true;
  return levelProgress(missionId(WORLDS[worldIndex].id, index - 1)).completed;
}
export function nextMission(worldIndex: number, index: number): { worldIndex: number; index: number } | null {
  if (index + 1 < LEVELS_PER_WORLD) return { worldIndex, index: index + 1 };
  if (worldIndex + 1 < WORLDS.length) return { worldIndex: worldIndex + 1, index: 0 };
  return null;
}

export function starsForRun(heartsLeft: number, maxHearts: number): number {
  const lost = maxHearts - heartsLeft;
  return lost === 0 ? 3 : lost === 1 ? 2 : 1;
}

export function coinsForRun(landed: number, stars: number, multiplier: number): number {
  return Math.round((landed * 6 + [0, 20, 45, 80][stars]) * multiplier);
}
