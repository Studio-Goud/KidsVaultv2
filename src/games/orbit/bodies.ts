/**
 * The solar system as Orbit draws it.
 *
 * Colours are taken from what the planets actually look like through a telescope or from a probe,
 * not from the primary-colour set children's books tend to use. Diameters are real, in kilometres,
 * so the size round is honest. Distances are in millions of kilometres from the sun.
 */

export type Surface = 'rock' | 'cloudy' | 'ocean' | 'rusty' | 'banded' | 'icy' | 'star';

export interface Body {
  id: string;
  /** a planet unless it says otherwise; the puzzle only ever asks about the eight planets */
  kind?: 'star' | 'dwarf';
  name: string;
  nameNl: string;
  /** equatorial diameter in km */
  diameter: number;
  /** average distance from the sun in millions of km */
  distance: number;
  surface: Surface;
  /** base disc colour and the two tones the surface is mottled or banded with */
  base: string;
  light: string;
  dark: string;
  /** Saturn and Uranus carry rings; the number is the outer radius as a multiple of the disc */
  ring?: { outer: number; inner: number; color: string; tilt: number };
  /** a great storm, as a fraction of the disc: x and y from the centre, and its radius */
  storm?: { x: number; y: number; r: number; color: string };
  /** polar caps, as a fraction of the disc radius */
  caps?: number;
  fact: string;
  factNl: string;
  /** how long one turn on its axis takes, in Earth hours */
  dayHours: number;
  /** how long one trip round the sun takes, in Earth days */
  yearDays: number;
  /** known moons; the count keeps rising, so the game says "at least" */
  moonCount: number;
  /** average temperature in degrees Celsius, at the surface or at the cloud tops */
  tempC: number;
  /** the moons we have a photograph of */
  moonIds: string[];
}

export interface Moon {
  id: string;
  name: string;
  nameNl: string;
  parent: string;
  diameter: number;
  fact: string;
  factNl: string;
}

export const MOONS: Moon[] = [
  { id: 'moon', name: 'The Moon', nameNl: 'De Maan', parent: 'earth', diameter: 3475,
    fact: 'The only other world anyone has ever stood on.',
    factNl: 'De enige andere wereld waar ooit iemand op gestaan heeft.' },
  { id: 'phobos', name: 'Phobos', nameNl: 'Phobos', parent: 'mars', diameter: 22,
    fact: 'A lumpy little moon that races round Mars three times a day.',
    factNl: 'Een klein klompje dat drie keer per dag om Mars heen raast.' },
  { id: 'io', name: 'Io', nameNl: 'Io', parent: 'jupiter', diameter: 3643,
    fact: 'The most volcanic place in the solar system.',
    factNl: 'De plek met de meeste vulkanen van het zonnestelsel.' },
  { id: 'europa', name: 'Europa', nameNl: 'Europa', parent: 'jupiter', diameter: 3122,
    fact: 'An ocean of liquid water hides under its ice.',
    factNl: 'Onder het ijs ligt een oceaan van vloeibaar water verstopt.' },
  { id: 'ganymede', name: 'Ganymede', nameNl: 'Ganymedes', parent: 'jupiter', diameter: 5268,
    fact: 'The largest moon there is, bigger than the planet Mercury.',
    factNl: 'De grootste maan die er is, groter dan de planeet Mercurius.' },
  { id: 'callisto', name: 'Callisto', nameNl: 'Callisto', parent: 'jupiter', diameter: 4821,
    fact: 'The most cratered world we know of: nothing has smoothed it over in four billion years.',
    factNl: 'De wereld met de meeste kraters die we kennen: in vier miljard jaar is er niets gladgestreken.' },
  { id: 'titan', name: 'Titan', nameNl: 'Titan', parent: 'saturn', diameter: 5150,
    fact: 'It has rivers and lakes, but of liquid methane, not water.',
    factNl: 'Het heeft rivieren en meren, maar van vloeibaar methaan, niet van water.' },
  { id: 'enceladus', name: 'Enceladus', nameNl: 'Enceladus', parent: 'saturn', diameter: 504,
    fact: 'Fountains of ice shoot out of its south pole into space.',
    factNl: 'Uit zijn zuidpool spuiten ijsfonteinen de ruimte in.' },
  { id: 'triton', name: 'Triton', nameNl: 'Triton', parent: 'neptune', diameter: 2707,
    fact: 'It goes round Neptune backwards, so it was probably captured.',
    factNl: 'Hij draait achterstevoren om Neptunus, dus hij is waarschijnlijk gevangen.' },
  { id: 'charon', name: 'Charon', nameNl: 'Charon', parent: 'pluto', diameter: 1212,
    fact: 'So big next to Pluto that the two of them swing round a point in the empty space between.',
    factNl: 'Zo groot naast Pluto dat ze samen om een punt in de lege ruimte ertussen draaien.' },
];

export const moonsOf = (planetId: string): Moon[] => MOONS.filter(m => m.parent === planetId);

export const SUN = { base: '#ffd86b', light: '#fff4c4', dark: '#f0932a' };

export const BODIES: Body[] = [
  {
    id: 'mercury', name: 'Mercury', nameNl: 'Mercurius',
    diameter: 4879, distance: 58, surface: 'rock',
    base: '#8c8378', light: '#b3a99c', dark: '#5f574f',
    fact: 'The smallest planet, and the fastest around the sun.',
    factNl: 'De kleinste planeet, en de snelste rond de zon.',
    dayHours: 1407.6, yearDays: 88, moonCount: 0, tempC: 167, moonIds: [],
  },
  {
    id: 'venus', name: 'Venus', nameNl: 'Venus',
    diameter: 12104, distance: 108, surface: 'cloudy',
    base: '#e6cfa0', light: '#f7ecc8', dark: '#c2a367',
    fact: 'Wrapped in thick cloud, and hotter than Mercury.',
    factNl: 'Verpakt in dikke wolken, en heter dan Mercurius.',
    dayHours: 5832.5, yearDays: 224.7, moonCount: 0, tempC: 464, moonIds: [],
  },
  {
    id: 'earth', name: 'Earth', nameNl: 'Aarde',
    diameter: 12756, distance: 150, surface: 'ocean',
    base: '#2a6fb5', light: '#4f8f4a', dark: '#1b4a80',
    caps: 0.16,
    fact: 'The only place we know of where anything lives.',
    factNl: 'De enige plek waarvan we weten dat er iets leeft.',
    dayHours: 23.9, yearDays: 365.2, moonCount: 1, tempC: 15, moonIds: ['moon'],
  },
  {
    id: 'mars', name: 'Mars', nameNl: 'Mars',
    diameter: 6792, distance: 228, surface: 'rusty',
    base: '#c1603c', light: '#dd8a5f', dark: '#8f4630',
    caps: 0.18,
    fact: 'Rusty red, with the tallest volcano in the solar system.',
    factNl: 'Roestrood, met de hoogste vulkaan van het zonnestelsel.',
    dayHours: 24.6, yearDays: 687, moonCount: 2, tempC: -65, moonIds: ['phobos'],
  },
  {
    id: 'jupiter', name: 'Jupiter', nameNl: 'Jupiter',
    diameter: 142984, distance: 778, surface: 'banded',
    base: '#d8c0a0', light: '#efe3cd', dark: '#a8794f',
    storm: { x: 0.22, y: 0.18, r: 0.17, color: '#b5604a' },
    fact: 'So big that every other planet would fit inside it.',
    factNl: 'Zo groot dat alle andere planeten erin passen.',
    dayHours: 9.9, yearDays: 4331, moonCount: 95, tempC: -110, moonIds: ['io', 'europa', 'ganymede', 'callisto'],
  },
  {
    id: 'saturn', name: 'Saturn', nameNl: 'Saturnus',
    diameter: 120536, distance: 1434, surface: 'banded',
    base: '#e3d3ab', light: '#f6ecd0', dark: '#b79c69',
    ring: { outer: 2.15, inner: 1.22, color: '#cbbb99', tilt: 0.26 },
    fact: 'Its rings are billions of pieces of ice and rock.',
    factNl: 'Zijn ringen zijn miljarden stukjes ijs en steen.',
    dayHours: 10.7, yearDays: 10747, moonCount: 146, tempC: -140, moonIds: ['titan', 'enceladus'],
  },
  {
    id: 'uranus', name: 'Uranus', nameNl: 'Uranus',
    diameter: 51118, distance: 2871, surface: 'icy',
    base: '#9fd8de', light: '#cdeef1', dark: '#6fb2bd',
    ring: { outer: 1.75, inner: 1.55, color: '#8fb8c4', tilt: 1.35 },
    fact: 'It rolls around the sun lying on its side.',
    factNl: 'Hij rolt op zijn zij om de zon heen.',
    dayHours: 17.2, yearDays: 30589, moonCount: 28, tempC: -195, moonIds: [],
  },
  {
    id: 'neptune', name: 'Neptune', nameNl: 'Neptunus',
    diameter: 49528, distance: 4495, surface: 'icy',
    base: '#3f68c4', light: '#7796e0', dark: '#27407f',
    storm: { x: -0.18, y: 0.1, r: 0.13, color: '#22356b' },
    fact: 'The windiest planet: gales faster than a jet aircraft.',
    factNl: 'De winderigste planeet: stormen sneller dan een straaljager.',
    dayHours: 16.1, yearDays: 59800, moonCount: 16, tempC: -200, moonIds: ['triton'],
  },
];

/**
 * The sun and the two dwarf planets a child is most likely to ask about.
 *
 * They are kept out of BODIES on purpose: the puzzle is about the eight planets and nothing else,
 * and the to-scale strip would squash everything inside Neptune if Pluto joined it. Explore has
 * room for them, and Explore is where the asking happens.
 */
export const EXTRA_WORLDS: Body[] = [
  {
    id: 'sun', kind: 'star', name: 'The Sun', nameNl: 'De Zon',
    diameter: 1391400, distance: 0, surface: 'star',
    base: '#ff8c2b', light: '#ffd06a', dark: '#d4531a',
    fact: 'Everything else here goes round it. It is almost all of the solar system by weight.',
    factNl: 'Al het andere hier draait eromheen. Hij is bijna het hele zonnestelsel, qua gewicht.',
    dayHours: 609.1, yearDays: 0, moonCount: 0, tempC: 5500, moonIds: [],
  },
  {
    id: 'ceres', kind: 'dwarf', name: 'Ceres', nameNl: 'Ceres',
    diameter: 939, distance: 414, surface: 'rock',
    base: '#9a958e', light: '#c9c5bd', dark: '#6a6660',
    fact: 'The biggest thing in the asteroid belt, with bright salt patches at the bottom of a crater.',
    factNl: 'Het grootste ding in de planetoidengordel, met heldere zoutvlekken in een kraterbodem.',
    dayHours: 9.07, yearDays: 1682, moonCount: 0, tempC: -105, moonIds: [],
  },
  {
    id: 'pluto', kind: 'dwarf', name: 'Pluto', nameNl: 'Pluto',
    diameter: 2377, distance: 5906, surface: 'icy',
    base: '#c9a98d', light: '#e8dcc9', dark: '#8a6f56',
    fact: 'A dwarf planet with a frozen heart of nitrogen, and a moon half its own size.',
    factNl: 'Een dwergplaneet met een bevroren hart van stikstof, en een maan half zo groot als hijzelf.',
    dayHours: 153.3, yearDays: 90560, moonCount: 5, tempC: -229, moonIds: ['charon'],
  },
];

/** Everything Explore will show, in order out from the sun. */
export const EXPLORE_WORLDS: Body[] = [
  EXTRA_WORLDS[0],
  ...BODIES.slice(0, 4),
  EXTRA_WORLDS[1],
  ...BODIES.slice(4),
  EXTRA_WORLDS[2],
];

export const byId = (id: string): Body => [...BODIES, ...EXTRA_WORLDS].find(b => b.id === id)!;
