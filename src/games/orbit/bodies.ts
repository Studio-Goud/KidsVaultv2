/**
 * The solar system as Orbit draws it.
 *
 * Colours are taken from what the planets actually look like through a telescope or from a probe,
 * not from the primary-colour set children's books tend to use. Diameters are real, in kilometres,
 * so the size round is honest. Distances are in millions of kilometres from the sun.
 */

export type Surface = 'rock' | 'cloudy' | 'ocean' | 'rusty' | 'banded' | 'icy';

export interface Body {
  id: string;
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
}

export const SUN = { base: '#ffd86b', light: '#fff4c4', dark: '#f0932a' };

export const BODIES: Body[] = [
  {
    id: 'mercury', name: 'Mercury', nameNl: 'Mercurius',
    diameter: 4879, distance: 58, surface: 'rock',
    base: '#8c8378', light: '#b3a99c', dark: '#5f574f',
    fact: 'The smallest planet, and the fastest around the sun.',
    factNl: 'De kleinste planeet, en de snelste rond de zon.',
  },
  {
    id: 'venus', name: 'Venus', nameNl: 'Venus',
    diameter: 12104, distance: 108, surface: 'cloudy',
    base: '#e6cfa0', light: '#f7ecc8', dark: '#c2a367',
    fact: 'Wrapped in thick cloud, and hotter than Mercury.',
    factNl: 'Verpakt in dikke wolken, en heter dan Mercurius.',
  },
  {
    id: 'earth', name: 'Earth', nameNl: 'Aarde',
    diameter: 12756, distance: 150, surface: 'ocean',
    base: '#2a6fb5', light: '#4f8f4a', dark: '#1b4a80',
    caps: 0.16,
    fact: 'The only place we know of where anything lives.',
    factNl: 'De enige plek waarvan we weten dat er iets leeft.',
  },
  {
    id: 'mars', name: 'Mars', nameNl: 'Mars',
    diameter: 6792, distance: 228, surface: 'rusty',
    base: '#c1603c', light: '#dd8a5f', dark: '#8f4630',
    caps: 0.18,
    fact: 'Rusty red, with the tallest volcano in the solar system.',
    factNl: 'Roestrood, met de hoogste vulkaan van het zonnestelsel.',
  },
  {
    id: 'jupiter', name: 'Jupiter', nameNl: 'Jupiter',
    diameter: 142984, distance: 778, surface: 'banded',
    base: '#d8c0a0', light: '#efe3cd', dark: '#a8794f',
    storm: { x: 0.22, y: 0.18, r: 0.17, color: '#b5604a' },
    fact: 'So big that every other planet would fit inside it.',
    factNl: 'Zo groot dat alle andere planeten erin passen.',
  },
  {
    id: 'saturn', name: 'Saturn', nameNl: 'Saturnus',
    diameter: 120536, distance: 1434, surface: 'banded',
    base: '#e3d3ab', light: '#f6ecd0', dark: '#b79c69',
    ring: { outer: 2.15, inner: 1.22, color: '#cbbb99', tilt: 0.26 },
    fact: 'Its rings are billions of pieces of ice and rock.',
    factNl: 'Zijn ringen zijn miljarden stukjes ijs en steen.',
  },
  {
    id: 'uranus', name: 'Uranus', nameNl: 'Uranus',
    diameter: 51118, distance: 2871, surface: 'icy',
    base: '#9fd8de', light: '#cdeef1', dark: '#6fb2bd',
    ring: { outer: 1.75, inner: 1.55, color: '#8fb8c4', tilt: 1.35 },
    fact: 'It rolls around the sun lying on its side.',
    factNl: 'Hij rolt op zijn zij om de zon heen.',
  },
  {
    id: 'neptune', name: 'Neptune', nameNl: 'Neptunus',
    diameter: 49528, distance: 4495, surface: 'icy',
    base: '#3f68c4', light: '#7796e0', dark: '#27407f',
    storm: { x: -0.18, y: 0.1, r: 0.13, color: '#22356b' },
    fact: 'The windiest planet: gales faster than a jet aircraft.',
    factNl: 'De winderigste planeet: stormen sneller dan een straaljager.',
  },
];

export const byId = (id: string): Body => BODIES.find(b => b.id === id)!;
