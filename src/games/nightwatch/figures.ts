/**
 * Night Watch figures.
 *
 * Every figure is a small set of stars and the lines between them, in a 0..1 square.
 * They are hand placed rather than generated, because a constellation only reads as an
 * animal when a person decided where the shoulder goes.
 *
 * `order` lists the edges in the order the sky draws them during the showing phase, so the
 * figure appears the way you would trace it with a finger: one continuous movement where
 * possible.
 */

export interface Figure {
  id: string;
  /** English name, shown to the player. */
  name: string;
  /** Dutch name. */
  nameNl: string;
  /** star positions in a 0..1 square, y downwards */
  stars: Array<[number, number]>;
  /** undirected edges as star index pairs, in drawing order */
  edges: Array<[number, number]>;
}

export const FIGURES: Figure[] = [
  {
    id: 'kite', name: 'The Kite', nameNl: 'De Vlieger',
    stars: [[0.50, 0.12], [0.76, 0.40], [0.50, 0.70], [0.24, 0.40]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0]],
  },
  {
    id: 'hare', name: 'The Hare', nameNl: 'De Haas',
    stars: [[0.30, 0.20], [0.42, 0.34], [0.38, 0.52], [0.58, 0.60], [0.72, 0.48], [0.20, 0.30]],
    edges: [[5, 1], [0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    id: 'swan', name: 'The Swan', nameNl: 'De Zwaan',
    stars: [[0.50, 0.10], [0.50, 0.34], [0.50, 0.60], [0.50, 0.84], [0.22, 0.46], [0.78, 0.46]],
    edges: [[0, 1], [1, 2], [2, 3], [4, 2], [2, 5]],
  },
  {
    id: 'fox', name: 'The Fox', nameNl: 'De Vos',
    stars: [[0.22, 0.34], [0.38, 0.22], [0.52, 0.36], [0.70, 0.30], [0.78, 0.52], [0.56, 0.62], [0.34, 0.58]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]],
  },
  {
    id: 'whale', name: 'The Whale', nameNl: 'De Walvis',
    stars: [[0.16, 0.50], [0.36, 0.40], [0.60, 0.42], [0.80, 0.34], [0.84, 0.58], [0.58, 0.62], [0.34, 0.60]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]],
  },
  {
    id: 'owl', name: 'The Owl', nameNl: 'De Uil',
    stars: [[0.36, 0.20], [0.64, 0.20], [0.50, 0.36], [0.30, 0.54], [0.70, 0.54], [0.50, 0.74], [0.50, 0.54]],
    edges: [[0, 2], [2, 1], [2, 6], [6, 3], [6, 4], [6, 5]],
  },
  {
    id: 'plough', name: 'The Plough', nameNl: 'De Ploeg',
    stars: [[0.14, 0.62], [0.30, 0.56], [0.46, 0.58], [0.60, 0.48], [0.74, 0.40], [0.80, 0.58], [0.64, 0.66]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    id: 'deer', name: 'The Deer', nameNl: 'Het Hert',
    stars: [[0.26, 0.18], [0.40, 0.30], [0.58, 0.26], [0.50, 0.44], [0.50, 0.66], [0.32, 0.80], [0.70, 0.78], [0.74, 0.14]],
    edges: [[0, 1], [1, 3], [7, 2], [2, 3], [3, 4], [4, 5], [4, 6]],
  },
];

/** An edge key that does not care which way round the two stars are. */
export const edgeKey = (a: number, b: number): string => (a < b ? `${a}-${b}` : `${b}-${a}`);
