/**
 * Het jaar rond: the days, the months, the seasons, the parts of the day - and where each question
 * comes from.
 *
 * Nothing here touches a canvas or a window, so it can be tested without a browser. Every sentence
 * a child ever hears lives in this file as a complete literal (never assembled from a template at
 * run time), because the voice is pre-recorded per literal sentence: see `docs/voice.md` and the
 * rule in `platform/voice.ts`.
 *
 * Two facts worth naming, because CLAUDE.md's rule five asks every number to say where it comes
 * from:
 *  - the Dutch week starts on maandag. That is the ISO-8601 convention the Netherlands uses, and
 *    it is why `DAYS` below is ordered maandag first, not the Sunday-first order an American
 *    calendar uses;
 *  - the seasons are the meteorological ones KNMI uses for its own record-keeping: lente is maart,
 *    april, mei; zomer is juni, juli, augustus; herfst is september, oktober, november; winter is
 *    december, januari, februari. Not the astronomical seasons, which turn a few weeks later and
 *    would put the equinox in the middle of "lente" instead of at its start.
 */

import { makeRng } from '../../util/rng';

// ---------------------------------------------------------------- days

export interface DayInfo { id: string; en: string; nl: string; weekend: boolean }

/** Monday first - see the file comment. Index 0..6, maandag..zondag. */
export const DAYS: DayInfo[] = [
  { id: 'maandag', en: 'Monday', nl: 'Maandag', weekend: false },
  { id: 'dinsdag', en: 'Tuesday', nl: 'Dinsdag', weekend: false },
  { id: 'woensdag', en: 'Wednesday', nl: 'Woensdag', weekend: false },
  { id: 'donderdag', en: 'Thursday', nl: 'Donderdag', weekend: false },
  { id: 'vrijdag', en: 'Friday', nl: 'Vrijdag', weekend: false },
  { id: 'zaterdag', en: 'Saturday', nl: 'Zaterdag', weekend: true },
  { id: 'zondag', en: 'Sunday', nl: 'Zondag', weekend: true },
];

export const dayAfter = (i: number): number => (i + 1) % 7;
export const dayBefore = (i: number): number => (i + 6) % 7;

/**
 * Today, as an index into `DAYS`. `Date.getDay()` counts from Sunday (0); the week here counts
 * from Monday (0), so Sunday - the last day of the Dutch week - becomes index 6.
 */
export const todayIndex = (d: Date = new Date()): number => (d.getDay() + 6) % 7;

// ---------------------------------------------------------------- months and seasons

export type SeasonId = 'lente' | 'zomer' | 'herfst' | 'winter';

export interface MonthInfo { id: string; en: string; nl: string; season: SeasonId }

/** januari..december, index 0..11, each carrying the meteorological season it falls in. */
export const MONTHS: MonthInfo[] = [
  { id: 'januari', en: 'January', nl: 'Januari', season: 'winter' },
  { id: 'februari', en: 'February', nl: 'Februari', season: 'winter' },
  { id: 'maart', en: 'March', nl: 'Maart', season: 'lente' },
  { id: 'april', en: 'April', nl: 'April', season: 'lente' },
  { id: 'mei', en: 'May', nl: 'Mei', season: 'lente' },
  { id: 'juni', en: 'June', nl: 'Juni', season: 'zomer' },
  { id: 'juli', en: 'July', nl: 'Juli', season: 'zomer' },
  { id: 'augustus', en: 'August', nl: 'Augustus', season: 'zomer' },
  { id: 'september', en: 'September', nl: 'September', season: 'herfst' },
  { id: 'oktober', en: 'October', nl: 'Oktober', season: 'herfst' },
  { id: 'november', en: 'November', nl: 'November', season: 'herfst' },
  { id: 'december', en: 'December', nl: 'December', season: 'winter' },
];

export const monthAfter = (i: number): number => (i + 1) % 12;

export interface SeasonInfo {
  id: SeasonId; en: string; nl: string; months: number[];
  explainEn: string; explainNl: string;
}

export const SEASONS: SeasonInfo[] = [
  {
    id: 'lente', en: 'Spring', nl: 'Lente', months: [2, 3, 4],
    explainEn: 'In spring the buds open, the birds come back, and it rains a soft rain.',
    explainNl: 'In de lente gaan de knoppen open, komen de vogels terug, en valt er een zachte regen.',
  },
  {
    id: 'zomer', en: 'Summer', nl: 'Zomer', months: [5, 6, 7],
    explainEn: 'In summer the tree is full and green, the sun is bright, and it is warm enough for short sleeves.',
    explainNl: 'In de zomer staat de boom vol en groen, schijnt de zon fel, en is het warm genoeg voor korte mouwen.',
  },
  {
    id: 'herfst', en: 'Autumn', nl: 'Herfst', months: [8, 9, 10],
    explainEn: 'In autumn the leaves turn orange and fall, the wind picks up, and mushrooms grow.',
    explainNl: 'In de herfst worden de blaadjes oranje en vallen ze naar beneden, waait het harder, en groeien er paddenstoelen.',
  },
  {
    id: 'winter', en: 'Winter', nl: 'Winter', months: [11, 0, 1],
    explainEn: 'In winter the tree is bare, snow can fall and stay on the ground, and you wear a coat and a hat.',
    explainNl: 'In de winter staat de boom kaal, kan er sneeuw vallen en blijven liggen, en draag je een jas en een muts.',
  },
];

export const seasonOf = (info: SeasonInfo): SeasonInfo => info;
export const seasonOfMonth = (i: number): SeasonInfo => SEASONS.find(s => s.months.includes(i))!;
export const seasonById = (id: SeasonId): SeasonInfo => SEASONS.find(s => s.id === id)!;

// ---------------------------------------------------------------- parts of the day

export interface DaypartInfo {
  id: string; en: string; nl: string; sunAt: number;
  explainEn: string; explainNl: string;
}

/** `sunAt` is where the sun sits along the sky, 0 (left, sunrise) to 1 (right, sunset); nacht has no sun. */
export const DAYPARTS: DaypartInfo[] = [
  {
    id: 'ochtend', en: 'Morning', nl: 'Ochtend', sunAt: 0.14,
    explainEn: 'In the morning the sun comes up and you eat breakfast.',
    explainNl: 'In de ochtend komt de zon op en eet je je ontbijt.',
  },
  {
    id: 'middag', en: 'Afternoon', nl: 'Middag', sunAt: 0.5,
    explainEn: 'In the afternoon the sun stands high in the sky.',
    explainNl: 'In de middag staat de zon hoog aan de hemel.',
  },
  {
    id: 'avond', en: 'Evening', nl: 'Avond', sunAt: 0.86,
    explainEn: 'In the evening the sun goes down and you eat dinner.',
    explainNl: 'In de avond gaat de zon onder en eet je je avondeten.',
  },
  {
    id: 'nacht', en: 'Night', nl: 'Nacht', sunAt: -1,
    explainEn: 'At night the moon and the stars are out and you sleep.',
    explainNl: 'In de nacht staan de maan en de sterren aan de hemel en slaap je.',
  },
];

// ---------------------------------------------------------------- the ladder

export type LevelId = 'week' | 'order' | 'yesterday' | 'months' | 'seasons' | 'daypart';

export interface Level {
  id: LevelId; name: string; nameNl: string; rounds: number;
  hint: string; hintNl: string;
}

export const LEVELS: Level[] = [
  {
    id: 'week', name: 'The week', nameNl: 'De week', rounds: 6,
    hint: 'Seven wagons, seven days. Monday rides up front.',
    hintNl: 'Zeven wagons, zeven dagen. Maandag rijdt voorop.',
  },
  {
    id: 'order', name: 'In order', nameNl: 'Op volgorde', rounds: 6,
    hint: 'Tap the day that comes next.',
    hintNl: 'Tik de dag die hierna komt.',
  },
  {
    id: 'yesterday', name: 'Yesterday and tomorrow', nameNl: 'Gisteren en morgen', rounds: 6,
    hint: 'Yesterday is one day back, tomorrow is one day on.',
    hintNl: 'Gisteren is een dag terug, morgen is een dag verder.',
  },
  {
    id: 'months', name: 'The months', nameNl: 'De maanden', rounds: 6,
    hint: 'Twelve months make a year. January comes first.',
    hintNl: 'Twaalf maanden maken een jaar. Januari komt eerst.',
  },
  {
    id: 'seasons', name: 'The seasons', nameNl: 'De seizoenen', rounds: 6,
    hint: 'Slide across the picture and watch the tree change.',
    hintNl: 'Veeg over de tekening en kijk hoe de boom verandert.',
  },
  {
    id: 'daypart', name: 'Day and night', nameNl: 'Dag en nacht', rounds: 6,
    hint: 'Slide the sun across the sky.',
    hintNl: 'Schuif de zon over de hemel.',
  },
];

export const rngFor = (level: Level, attempt: number): (() => number) =>
  makeRng(level.id.length * 397 + attempt * 29 + 11);

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// ---------------------------------------------------------------- question pools
//
// Every question is written out in full, in both languages, because a composed sentence
// ("Welke dag komt na ${day}?") would fall back to the robot voice - see the file comment.

export interface Label { en: string; nl: string }
type Domain = 'day' | 'month' | 'season' | 'daypart';

interface PoolEntry { textEn: string; textNl: string; domain: Domain; correct: number }

const DAY_LABEL = (i: number): Label => ({ en: DAYS[i].en, nl: DAYS[i].nl });
const MONTH_LABEL = (i: number): Label => ({ en: MONTHS[i].en, nl: MONTHS[i].nl });
const SEASON_LABEL = (s: SeasonId): Label => { const x = seasonById(s); return { en: x.en, nl: x.nl }; };
const DAYPART_LABEL = (id: string): Label => { const x = DAYPARTS.find(d => d.id === id)!; return { en: x.en, nl: x.nl }; };

/** "Which day comes after X?" - one for every day, so the whole week is covered. */
const WEEK_AFTER: PoolEntry[] = [
  { textEn: 'Which day comes after Monday?', textNl: 'Welke dag komt na maandag?', domain: 'day', correct: dayAfter(0) },
  { textEn: 'Which day comes after Tuesday?', textNl: 'Welke dag komt na dinsdag?', domain: 'day', correct: dayAfter(1) },
  { textEn: 'Which day comes after Wednesday?', textNl: 'Welke dag komt na woensdag?', domain: 'day', correct: dayAfter(2) },
  { textEn: 'Which day comes after Thursday?', textNl: 'Welke dag komt na donderdag?', domain: 'day', correct: dayAfter(3) },
  { textEn: 'Which day comes after Friday?', textNl: 'Welke dag komt na vrijdag?', domain: 'day', correct: dayAfter(4) },
  { textEn: 'Which day comes after Saturday?', textNl: 'Welke dag komt na zaterdag?', domain: 'day', correct: dayAfter(5) },
  { textEn: 'Which day comes after Sunday?', textNl: 'Welke dag komt na zondag?', domain: 'day', correct: dayAfter(6) },
];

/** "If today is X, what was it yesterday / what is it tomorrow?" - one pair per day. */
const YESTERDAY_TOMORROW: PoolEntry[] = [
  { textEn: 'If today is Monday, what day was it yesterday?', textNl: 'Als vandaag maandag is, welke dag was het gisteren?', domain: 'day', correct: dayBefore(0) },
  { textEn: 'If today is Monday, what day is it tomorrow?', textNl: 'Als vandaag maandag is, welke dag is het morgen?', domain: 'day', correct: dayAfter(0) },
  { textEn: 'If today is Tuesday, what day was it yesterday?', textNl: 'Als vandaag dinsdag is, welke dag was het gisteren?', domain: 'day', correct: dayBefore(1) },
  { textEn: 'If today is Tuesday, what day is it tomorrow?', textNl: 'Als vandaag dinsdag is, welke dag is het morgen?', domain: 'day', correct: dayAfter(1) },
  { textEn: 'If today is Wednesday, what day was it yesterday?', textNl: 'Als vandaag woensdag is, welke dag was het gisteren?', domain: 'day', correct: dayBefore(2) },
  { textEn: 'If today is Wednesday, what day is it tomorrow?', textNl: 'Als vandaag woensdag is, welke dag is het morgen?', domain: 'day', correct: dayAfter(2) },
  { textEn: 'If today is Thursday, what day was it yesterday?', textNl: 'Als vandaag donderdag is, welke dag was het gisteren?', domain: 'day', correct: dayBefore(3) },
  { textEn: 'If today is Thursday, what day is it tomorrow?', textNl: 'Als vandaag donderdag is, welke dag is het morgen?', domain: 'day', correct: dayAfter(3) },
  { textEn: 'If today is Friday, what day was it yesterday?', textNl: 'Als vandaag vrijdag is, welke dag was het gisteren?', domain: 'day', correct: dayBefore(4) },
  { textEn: 'If today is Friday, what day is it tomorrow?', textNl: 'Als vandaag vrijdag is, welke dag is het morgen?', domain: 'day', correct: dayAfter(4) },
  { textEn: 'If today is Saturday, what day was it yesterday?', textNl: 'Als vandaag zaterdag is, welke dag was het gisteren?', domain: 'day', correct: dayBefore(5) },
  { textEn: 'If today is Saturday, what day is it tomorrow?', textNl: 'Als vandaag zaterdag is, welke dag is het morgen?', domain: 'day', correct: dayAfter(5) },
  { textEn: 'If today is Sunday, what day was it yesterday?', textNl: 'Als vandaag zondag is, welke dag was het gisteren?', domain: 'day', correct: dayBefore(6) },
  { textEn: 'If today is Sunday, what day is it tomorrow?', textNl: 'Als vandaag zondag is, welke dag is het morgen?', domain: 'day', correct: dayAfter(6) },
];

/** "Which month comes after X?" - one for every month, so the whole year is covered. */
const MONTH_AFTER: PoolEntry[] = [
  { textEn: 'Which month comes after January?', textNl: 'Welke maand komt na januari?', domain: 'month', correct: monthAfter(0) },
  { textEn: 'Which month comes after February?', textNl: 'Welke maand komt na februari?', domain: 'month', correct: monthAfter(1) },
  { textEn: 'Which month comes after March?', textNl: 'Welke maand komt na maart?', domain: 'month', correct: monthAfter(2) },
  { textEn: 'Which month comes after April?', textNl: 'Welke maand komt na april?', domain: 'month', correct: monthAfter(3) },
  { textEn: 'Which month comes after May?', textNl: 'Welke maand komt na mei?', domain: 'month', correct: monthAfter(4) },
  { textEn: 'Which month comes after June?', textNl: 'Welke maand komt na juni?', domain: 'month', correct: monthAfter(5) },
  { textEn: 'Which month comes after July?', textNl: 'Welke maand komt na juli?', domain: 'month', correct: monthAfter(6) },
  { textEn: 'Which month comes after August?', textNl: 'Welke maand komt na augustus?', domain: 'month', correct: monthAfter(7) },
  { textEn: 'Which month comes after September?', textNl: 'Welke maand komt na september?', domain: 'month', correct: monthAfter(8) },
  { textEn: 'Which month comes after October?', textNl: 'Welke maand komt na oktober?', domain: 'month', correct: monthAfter(9) },
  { textEn: 'Which month comes after November?', textNl: 'Welke maand komt na november?', domain: 'month', correct: monthAfter(10) },
  { textEn: 'Which month comes after December?', textNl: 'Welke maand komt na december?', domain: 'month', correct: monthAfter(11) },
];

/**
 * Fixed Dutch calendar dates. All four are certainly true every year: Nieuwjaar is 1 January,
 * Koningsdag is 27 April, Sinterklaas arrives in early December and Kerst is 25 December - so each
 * is asked about by month, never by day, which is the part that never changes.
 */
const MONTH_FACTS: PoolEntry[] = [
  { textEn: 'When is New Year?', textNl: 'Wanneer is Nieuwjaar?', domain: 'month', correct: 0 },
  { textEn: "When is King's Day?", textNl: 'Wanneer is Koningsdag?', domain: 'month', correct: 3 },
  { textEn: 'When does Sinterklaas come?', textNl: 'Wanneer komt Sinterklaas?', domain: 'month', correct: 11 },
  { textEn: 'When is Christmas?', textNl: 'Wanneer is Kerst?', domain: 'month', correct: 11 },
];

/** The four questions the level was written for, plus one per month so the whole year is covered. */
const SEASON_THEMATIC: PoolEntry[] = [
  { textEn: 'When do the leaves fall from the trees?', textNl: 'Wanneer vallen de blaadjes van de bomen?', domain: 'season', correct: 2 },
  { textEn: 'When can it snow?', textNl: 'Wanneer kan het sneeuwen?', domain: 'season', correct: 3 },
  { textEn: 'When do the first flowers open?', textNl: 'Wanneer gaan de eerste bloemen open?', domain: 'season', correct: 0 },
  { textEn: 'When is it usually warmest?', textNl: 'Wanneer is het meestal het warmst?', domain: 'season', correct: 1 },
];
const SEASON_ORDER: SeasonId[] = ['lente', 'zomer', 'herfst', 'winter'];
const SEASON_MONTH: PoolEntry[] = [
  { textEn: 'In which season does January fall?', textNl: 'In welk seizoen valt januari?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(0).id) },
  { textEn: 'In which season does February fall?', textNl: 'In welk seizoen valt februari?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(1).id) },
  { textEn: 'In which season does March fall?', textNl: 'In welk seizoen valt maart?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(2).id) },
  { textEn: 'In which season does April fall?', textNl: 'In welk seizoen valt april?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(3).id) },
  { textEn: 'In which season does May fall?', textNl: 'In welk seizoen valt mei?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(4).id) },
  { textEn: 'In which season does June fall?', textNl: 'In welk seizoen valt juni?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(5).id) },
  { textEn: 'In which season does July fall?', textNl: 'In welk seizoen valt juli?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(6).id) },
  { textEn: 'In which season does August fall?', textNl: 'In welk seizoen valt augustus?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(7).id) },
  { textEn: 'In which season does September fall?', textNl: 'In welk seizoen valt september?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(8).id) },
  { textEn: 'In which season does October fall?', textNl: 'In welk seizoen valt oktober?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(9).id) },
  { textEn: 'In which season does November fall?', textNl: 'In welk seizoen valt november?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(10).id) },
  { textEn: 'In which season does December fall?', textNl: 'In welk seizoen valt december?', domain: 'season', correct: SEASON_ORDER.indexOf(seasonOfMonth(11).id) },
];

const DAYPART_ORDER = ['ochtend', 'middag', 'avond', 'nacht'];
const DAYPART_POOL: PoolEntry[] = [
  { textEn: 'When do you eat breakfast?', textNl: 'Wanneer eet je je ontbijt?', domain: 'daypart', correct: 0 },
  { textEn: 'When do you see the stars?', textNl: 'Wanneer zie je de sterren?', domain: 'daypart', correct: 3 },
  { textEn: 'When do you get up?', textNl: 'Wanneer sta je op?', domain: 'daypart', correct: 0 },
  { textEn: 'When do you eat dinner?', textNl: 'Wanneer eet je je avondeten?', domain: 'daypart', correct: 2 },
  { textEn: 'When do you go to bed?', textNl: 'Wanneer ga je naar bed?', domain: 'daypart', correct: 3 },
  { textEn: 'When is the sun highest in the sky?', textNl: 'Wanneer staat de zon het hoogst?', domain: 'daypart', correct: 1 },
  { textEn: 'When do you see the moon?', textNl: 'Wanneer zie je de maan?', domain: 'daypart', correct: 3 },
  { textEn: 'When do you go to school?', textNl: 'Wanneer ga je naar school?', domain: 'daypart', correct: 0 },
];

function poolFor(id: LevelId): PoolEntry[] {
  if (id === 'week') return WEEK_AFTER;
  if (id === 'yesterday') return YESTERDAY_TOMORROW;
  if (id === 'months') return [...MONTH_AFTER, ...MONTH_FACTS];
  if (id === 'seasons') return [...SEASON_THEMATIC, ...SEASON_MONTH];
  if (id === 'daypart') return DAYPART_POOL;
  return [];
}

function labelPool(domain: Domain): Label[] {
  if (domain === 'day') return DAYS.map((_, i) => DAY_LABEL(i));
  if (domain === 'month') return MONTHS.map((_, i) => MONTH_LABEL(i));
  if (domain === 'season') return SEASON_ORDER.map(s => SEASON_LABEL(s));
  return DAYPART_ORDER.map(d => DAYPART_LABEL(d));
}

export interface Question { textEn: string; textNl: string; options: Label[]; answer: number; domain: Domain }

/**
 * One question, with its three options shuffled. `avoidIndex` is the pool index used last time, so
 * the same sentence never comes up twice running - the one thing a repeat would break is the
 * feeling that the game is actually asking something.
 */
export function makeQuestion(level: Level, rng: () => number, avoidIndex = -1): { q: Question; poolIndex: number } {
  const pool = poolFor(level.id);
  let idx = Math.floor(rng() * pool.length);
  if (pool.length > 1) { for (let tries = 0; tries < 8 && idx === avoidIndex; tries++) idx = Math.floor(rng() * pool.length); }
  const entry = pool[idx];
  const labels = labelPool(entry.domain);
  const correct = labels[entry.correct];
  const others = labels.filter((_, i) => i !== entry.correct);
  const distractors = shuffle(others, rng).slice(0, Math.min(2, others.length));
  const options = shuffle([correct, ...distractors], rng);
  const answer = options.findIndex(o => o.nl === correct.nl);
  return { q: { textEn: entry.textEn, textNl: entry.textNl, options, answer, domain: entry.domain }, poolIndex: idx };
}

export const isRight = (q: Question, picked: number): boolean => picked === q.answer;

/**
 * Stars: what was picked right the first time, before the game showed the answer. Nobody fails -
 * every question ends up answered, so finishing a level is finishing it, same as every other game.
 */
export function starsFor(firstTry: number, total: number): number {
  if (total <= 0) return 0;
  const acc = firstTry / total;
  if (acc >= 0.95) return 3;
  if (acc >= 0.75) return 2;
  if (acc >= 0.5) return 1;
  return 0;
}

// ---------------------------------------------------------------- "op volgorde"

/**
 * The days still to be placed in the train, in the shuffled order they are offered as tiles.
 * `placed` is how many are already in the train (maandag is given, so this starts at 1); the
 * remaining `7 - placed` days are shuffled once per attempt via `rng`.
 */
export function remainingShuffled(rng: () => number, placed: number): number[] {
  const rest = DAYS.map((_, i) => i).slice(placed);
  return shuffle(rest, rng);
}
