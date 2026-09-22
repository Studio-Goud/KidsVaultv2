import type { Design, Placed } from './design';

/**
 * Three rockets that explain themselves.
 *
 * An empty launch pad is the hardest screen in the game. A child who has never built a rocket has
 * no idea that the engine goes at the bottom, that a tank is what an engine eats, or that anyone
 * has to ride on top - and a page of instructions would not tell them, because they would not
 * read it.
 *
 * So the empty pad offers three finished rockets instead. Tapping one does not just fill the grid:
 * the rocket builds itself, one part a moment, from the ground up, while the forecast rail on the
 * right climbs with every piece that lands. That is the lesson. Nobody says "the engine goes at
 * the bottom" - the engine simply goes at the bottom first, every time, and the mark for how high
 * this thing will get moves when the tank arrives.
 *
 * The three are not three difficulties. They are three different ideas:
 *
 *   1. the smallest thing that flies: engine, fuel, someone to ride, a point on top
 *   2. two stages: carrying an empty tank is what stops you, so let it go and light another engine
 *   3. strap-on boosters: enormous push for the first half minute, when weight is worst
 *
 * The heights in the cards are not written here. They are worked out by the same forecast the
 * build screen uses, so they cannot drift away from what the rocket actually does.
 */
export interface Example {
  id: string;
  name: string;
  nameNl: string;
  /** the one idea this rocket is for, in a child's words */
  why: string;
  whyNl: string;
  parts: Design;
}

const p = (id: string, col: number, row: number): Placed => ({ id, col, row });

export const EXAMPLES: Example[] = [
  {
    id: 'first',
    name: 'The little one',
    nameNl: 'Het kleintje',
    why: 'Engine at the bottom, fuel above it, you on top.',
    whyNl: 'Motor onderaan, brandstof erboven, jij bovenop.',
    parts: [p('engine-s', 4, 0), p('tank-s', 4, 1), p('capsule', 4, 3), p('nose', 4, 5)],
  },
  {
    id: 'twostage',
    name: 'The two-stager',
    nameNl: 'De tweetrapper',
    why: 'An empty tank is dead weight. Drop it and light the next engine.',
    whyNl: 'Een lege tank is dood gewicht. Laat hem los en start de volgende motor.',
    parts: [
      p('engine-l', 4, 0), p('tank-xl', 4, 1), p('decoupler', 4, 6),
      p('engine-v', 4, 7), p('tank-m', 4, 9), p('capsule', 4, 12), p('nose', 4, 14),
    ],
  },
  {
    id: 'boosters',
    name: 'The booster rocket',
    nameNl: 'De boosterraket',
    why: 'Two strap-on boosters shove the heaviest half minute out of the way.',
    whyNl: 'Twee vastgeplakte boosters duwen het zwaarste halve minuutje voorbij.',
    parts: [
      p('engine-m', 4, 0), p('tank-l', 4, 1), p('capsule', 4, 5), p('nose', 4, 7),
      p('srb-l', 3, 0), p('nose-xs', 3, 4), p('srb-l', 5, 0), p('nose-xs', 5, 4),
      p('fin-s', 2, 0), p('fin-s', 6, 0),
    ],
  },
];

/**
 * The order the parts of an example go on, which is the order a person would really build it:
 * up the middle column first, then whatever straps to the sides, each column from the ground up.
 */
export function buildOrder(e: Example): Placed[] {
  return [...e.parts].sort((a, b) => {
    const da = Math.abs(a.col - 4), db = Math.abs(b.col - 4);
    if (da !== db) return da - db;
    if (a.col !== b.col) return a.col - b.col;
    return a.row - b.row;
  });
}
