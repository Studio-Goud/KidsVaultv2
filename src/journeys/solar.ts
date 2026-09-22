/**
 * De grote reis - out from the sun to the edge, one stop per world.
 *
 * The first journey, and the one the format was designed around. Planetarium already knows these
 * eleven worlds and already ships a real photograph of each, so this costs the app no new assets
 * at all: what is new is the shape of the visit, not the subject.
 *
 * Every fact here is one a six-year-old can hold and none of them are wrong. Where a number keeps
 * changing - Jupiter's moons are counted again every few years - it says "at least".
 */

import type { Journey, Stop } from '../journey/types';

const at = (i: number, n: number): number => i / (n - 1);

const S: Array<Omit<Stop, 'at'>> = [
  {
    id: 'sun', title: 'The Sun', titleNl: 'De Zon', tone: '#f0a83c', mark: 0,
    picture: { kind: 'planet', id: 'sun' },
    say: 'The sun is a star. Everything out here goes round it.',
    sayNl: 'De zon is een ster. Alles hier draait om haar heen.',
    more: [
      { say: 'It is so big that a million earths would fit inside it.',
        sayNl: 'Ze is zo groot dat er een miljoen aardes in zouden passen.' },
      { say: 'Its light takes eight minutes to reach us.',
        sayNl: 'Het licht van de zon doet er acht minuten over om bij ons te komen.' },
    ],
  },
  {
    id: 'mercury', title: 'Mercury', titleNl: 'Mercurius', tone: '#9c8f86', mark: 58,
    picture: { kind: 'planet', id: 'mercury' },
    say: 'Mercury is the closest to the sun. Burning hot by day, freezing at night.',
    sayNl: "Mercurius staat het dichtst bij de zon. Overdag gloeiend heet, 's nachts ijskoud.",
    more: [
      { say: 'It has no air around it, so the warmth does not stay.',
        sayNl: 'Hij heeft geen lucht om zich heen, dus de warmte blijft niet hangen.' },
      { say: 'A year there lasts only eighty-eight days.',
        sayNl: 'Een jaar duurt er maar achtentachtig dagen.' },
    ],
  },
  {
    id: 'venus', title: 'Venus', titleNl: 'Venus', tone: '#d8b071', mark: 108,
    picture: { kind: 'planet', id: 'venus' },
    say: 'Venus is the same size as the earth, wrapped in thick cloud.',
    sayNl: 'Venus is even groot als de aarde, maar hij zit in dikke wolken.',
    more: [
      { say: 'It is hotter than Mercury, because the cloud holds the warmth in.',
        sayNl: 'Het is er heter dan op Mercurius, want de wolken houden de warmte vast.' },
      { say: 'Venus turns the other way round, so there the sun comes up in the west.',
        sayNl: 'Venus draait de andere kant op, dus daar komt de zon in het westen op.' },
    ],
  },
  {
    id: 'earth', title: 'Earth', titleNl: 'De Aarde', tone: '#3f7fb5', mark: 150,
    picture: { kind: 'planet', id: 'earth' },
    say: 'This is the earth. The only place we know of where anything lives.',
    sayNl: 'Dit is de aarde. De enige plek waar we leven kennen.',
    more: [
      { say: 'Almost three quarters of it is water.',
        sayNl: 'Bijna driekwart van de aarde is water.' },
      { say: 'The moon goes round us, and it is what pulls the tide up the beach.',
        sayNl: 'De maan draait om ons heen, en die trekt het water van eb en vloed.' },
    ],
  },
  {
    id: 'mars', title: 'Mars', titleNl: 'Mars', tone: '#b4623c', mark: 228,
    picture: { kind: 'planet', id: 'mars' },
    say: 'Mars is red from the rust in its sand.',
    sayNl: 'Mars is rood van het roest in zijn zand.',
    more: [
      { say: 'The tallest mountain anywhere stands on Mars: three times the height of Everest.',
        sayNl: 'De hoogste berg van het zonnestelsel staat op Mars: drie keer zo hoog als de Mount Everest.' },
      { say: 'Robots are driving about up there, taking photographs.',
        sayNl: "Er rijden robots rond die foto's maken." },
    ],
  },
  {
    id: 'ceres', title: 'The belt', titleNl: 'De gordel', tone: '#6b6560', mark: 414,
    picture: { kind: 'planet', id: 'ceres' },
    say: 'Between Mars and Jupiter float millions of lumps of rock.',
    sayNl: 'Tussen Mars en Jupiter zweven miljoenen brokken steen.',
    more: [
      { say: 'The biggest of them is Ceres, and it is round enough to be a little world of its own.',
        sayNl: 'De grootste heet Ceres, en die is rond genoeg om zelf een wereldje te zijn.' },
      { say: 'They lie so far apart that a spacecraft flies straight through without meeting one.',
        sayNl: 'Ze liggen zo ver uit elkaar dat een ruimteschip er zo tussendoor vliegt.' },
    ],
  },
  {
    id: 'jupiter', title: 'Jupiter', titleNl: 'Jupiter', tone: '#c89a6a', mark: 778,
    picture: { kind: 'planet', id: 'jupiter' },
    say: 'Jupiter is the biggest. It is a ball of gas, with no ground to stand on.',
    sayNl: 'Jupiter is de grootste. Hij is een bol van gas, zonder grond om op te staan.',
    more: [
      { say: 'The red spot is a storm that has been blowing for hundreds of years.',
        sayNl: 'De rode vlek is een storm die al honderden jaren waait.' },
      { say: 'At least ninety moons go round it.',
        sayNl: 'Er draaien minstens negentig manen omheen.' },
    ],
  },
  {
    id: 'saturn', title: 'Saturn', titleNl: 'Saturnus', tone: '#d9c28c', mark: 1432,
    picture: { kind: 'planet', id: 'saturn' },
    say: 'Saturn wears rings of ice and stone.',
    sayNl: 'Saturnus draagt ringen van ijs en steen.',
    more: [
      { say: 'The rings are enormously wide and thinner than a sheet of paper.',
        sayNl: 'De ringen zijn enorm breed en dunner dan een vel papier.' },
      { say: 'Saturn is so light for its size that it would float, if you had a bath big enough.',
        sayNl: 'Saturnus is zo licht voor zijn maat dat hij zou blijven drijven, als je een bad had dat groot genoeg was.' },
    ],
  },
  {
    id: 'uranus', title: 'Uranus', titleNl: 'Uranus', tone: '#93c8cf', mark: 2867,
    picture: { kind: 'planet', id: 'uranus' },
    say: 'Uranus lies on its side and rolls round the sun that way.',
    sayNl: 'Uranus ligt op zijn zij en rolt zo om de zon.',
    more: [
      { say: 'It is blue-green from a gas called methane.',
        sayNl: 'Hij is blauwgroen door een gas dat methaan heet.' },
      { say: 'One year there lasts eighty-four of ours.',
        sayNl: 'Eén jaar duurt er vierentachtig van onze jaren.' },
    ],
  },
  {
    id: 'neptune', title: 'Neptune', titleNl: 'Neptunus', tone: '#3a5ea8', mark: 4515,
    picture: { kind: 'planet', id: 'neptune' },
    say: 'Neptune is the furthest planet. The hardest winds anywhere blow there.',
    sayNl: 'Neptunus is de verste planeet. Daar waait de hardste wind van allemaal.',
    more: [
      { say: 'The sunlight is so weak out here that it is always dusk.',
        sayNl: 'Het zonlicht is hier zo zwak dat het er altijd schemer is.' },
      { say: 'Neptune was worked out with a pencil before anyone had seen it.',
        sayNl: 'Neptunus werd eerst uitgerekend en pas daarna gezien.' },
    ],
  },
  {
    id: 'pluto', title: 'Pluto', titleNl: 'Pluto', tone: '#8f7f72', mark: 5906,
    picture: { kind: 'planet', id: 'pluto' },
    say: 'Pluto is a dwarf planet, far smaller than the eight.',
    sayNl: 'Pluto is een dwergplaneet, veel kleiner dan de acht.',
    more: [
      { say: 'It has a plain of frozen nitrogen on it, shaped like a heart.',
        sayNl: 'Op Pluto ligt een vlakte van bevroren stikstof in de vorm van een hart.' },
      { say: 'In 2015 a probe called New Horizons flew past it for the first time.',
        sayNl: 'In 2015 vloog de sonde New Horizons er voor het eerst langs.' },
    ],
  },
];

export const SOLAR: Journey = {
  id: 'reis',
  title: 'The long way out', titleNl: 'De grote reis',
  opening: 'Strap in. We are going all the way out, and we stop at everything.',
  openingNl: 'Riem vast. We gaan helemaal naar buiten, en we stoppen overal.',
  closing: 'That is the whole of it. Everything you know is on one of those.',
  closingNl: 'Dat was hem. Alles wat je kent staat op een van die bollen.',
  craft: 'rocket', axis: 'up',
  unit: 'million km', unitNl: 'miljoen km',
  stops: S.map((s, i) => ({ ...s, at: at(i, S.length) })),
};
