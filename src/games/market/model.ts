/**
 * Marktdag: customers come to your stall with an order, and you fill their basket.
 *
 * Three apples. Two pears and a plum. Six strawberries shared fairly between two baskets. A basket
 * that already has two carrots in it and a customer who wants five. Every order is a small piece of
 * early arithmetic dressed as a shop: counting out, counting two things at once, sharing equally,
 * and the hardest one for a four year old, working out how many more.
 *
 * Nothing is written as a sum. The order is pictures and a numeral, and the answer is a basket you
 * can look into.
 */

import { makeRng } from '../../util/rng';

export type Fruit = 'apple' | 'pear' | 'strawberry' | 'plum' | 'carrot';
export const FRUITS: Fruit[] = ['apple', 'pear', 'strawberry', 'plum', 'carrot'];
export const FRUIT_NAME: Record<Fruit, [string, string, string, string]> = {
  // singular en, plural en, singular nl, plural nl
  apple: ['apple', 'apples', 'appel', 'appels'],
  pear: ['pear', 'pears', 'peer', 'peren'],
  strawberry: ['strawberry', 'strawberries', 'aardbei', 'aardbeien'],
  plum: ['plum', 'plums', 'pruim', 'pruimen'],
  carrot: ['carrot', 'carrots', 'wortel', 'wortels'],
};

export type Customer = 'hedgehog' | 'rabbit' | 'fox' | 'owl' | 'badger';
export const CUSTOMERS: Customer[] = ['hedgehog', 'rabbit', 'fox', 'owl', 'badger'];

export type OrderKind = 'count' | 'mixed' | 'share' | 'more';

export interface Order {
  kind: OrderKind;
  who: Customer;
  /** what the customer wants in total, per fruit */
  wants: Partial<Record<Fruit, number>>;
  /** for 'share': how many baskets it must be split across, equally */
  between: number;
  /** for 'more': what is already in the basket before you start */
  already: Partial<Record<Fruit, number>>;
  /** how long they will wait, in seconds */
  patience: number;
}

export interface Level {
  id: string;
  name: string;
  nameNl: string;
  /** how many customers come by */
  customers: number;
  kinds: OrderKind[];
  /** the largest single count that can be asked for */
  maxCount: number;
  /** which fruit are on the stall today */
  fruits: Fruit[];
  patience: number;
  /** how many ways a sharing order splits, where the level is named after the answer */
  share?: number;
  hint: string;
  hintNl: string;
}

export const LEVELS: Level[] = [
  { id: 'firstmorning', name: 'First morning', nameNl: 'De eerste ochtend', customers: 6, kinds: ['count'], maxCount: 3, fruits: ['apple', 'pear'], patience: 40,
    hint: 'Tap the crate to put fruit in the basket. Ring the bell when it is right.', hintNl: 'Tik op de kist om fruit in de mand te doen. Bel als het klopt.' },
  { id: 'uptofive', name: 'Up to five', nameNl: 'Tot vijf', customers: 7, kinds: ['count'], maxCount: 5, fruits: ['apple', 'pear', 'strawberry'], patience: 36,
    hint: 'Count out loud if it helps. Nobody minds.', hintNl: 'Hardop tellen mag. Niemand vindt dat gek.' },
  { id: 'twothings', name: 'Two things at once', nameNl: 'Twee dingen tegelijk', customers: 7, kinds: ['count', 'mixed'], maxCount: 4, fruits: ['apple', 'pear', 'plum'], patience: 36,
    hint: 'Some orders have two kinds of fruit. Do one, then the other.', hintNl: 'Sommige bestellingen hebben twee soorten fruit. Doe de een, dan de ander.' },
  { id: 'fairshare', name: 'Fair shares', nameNl: 'Eerlijk delen', customers: 7, kinds: ['count', 'share'], maxCount: 6, fruits: ['strawberry', 'plum'], patience: 40,
    hint: 'Two baskets, and they must get the same. One for you, one for me.', hintNl: 'Twee manden, en ze moeten hetzelfde krijgen. Een voor jou, een voor mij.' },
  { id: 'howmanymore', name: 'How many more', nameNl: 'Hoeveel erbij', customers: 8, kinds: ['count', 'more'], maxCount: 6, fruits: ['apple', 'carrot', 'pear'], patience: 38,
    hint: 'The basket already has some in it. Add only what is missing.', hintNl: 'Er zit al wat in de mand. Doe er alleen bij wat mist.' },
  { id: 'threeways', name: 'Three ways', nameNl: 'In drieën', customers: 8, kinds: ['share', 'mixed'], maxCount: 9, fruits: ['strawberry', 'plum', 'carrot'], patience: 40,
    share: 3,
    hint: 'When they want to share, it is three baskets now. One, one, one, then round again.',
    hintNl: 'Als ze willen delen, zijn het nu drie manden. Een, een, een, en dan weer rond.' },
  { id: 'busystall', name: 'The busy stall', nameNl: 'De drukke kraam', customers: 10, kinds: ['count', 'mixed', 'share', 'more'], maxCount: 8, fruits: ['apple', 'pear', 'strawberry', 'plum'], patience: 30,
    hint: 'A little of everything, and they are in more of a hurry.', hintNl: 'Van alles wat, en ze hebben meer haast.' },
  { id: 'marketday', name: 'Market day', nameNl: 'Marktdag', customers: 12, kinds: ['count', 'mixed', 'share', 'more'], maxCount: 10, fruits: FRUITS, patience: 26,
    hint: 'The whole village is here. Breathe, count, ring.', hintNl: 'Het hele dorp is er. Adem, tel, bel.' },
];

export const rngFor = (level: Level, attempt: number): (() => number) => makeRng(level.id.length * 211 + attempt * 13 + 7);

/** One order that fits the day. */
export function makeOrder(level: Level, rng: () => number, index: number): Order {
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  const kind = pick(level.kinds);
  const who = CUSTOMERS[(index + Math.floor(rng() * 2)) % CUSTOMERS.length];
  const wants: Partial<Record<Fruit, number>> = {};
  const already: Partial<Record<Fruit, number>> = {};
  let between = 1;
  const n = (lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

  if (kind === 'count') {
    wants[pick(level.fruits)] = n(1, level.maxCount);
  } else if (kind === 'mixed') {
    const [a, b] = [...level.fruits].sort(() => rng() - 0.5);
    const total = n(2, Math.max(2, level.maxCount));
    const first = n(1, total - 1);
    wants[a] = first; wants[b] = total - first;
  } else if (kind === 'share') {
    between = level.share ?? (level.maxCount >= 9 && rng() < 0.6 ? 3 : 2);
    const each = n(1, Math.max(1, Math.floor(level.maxCount / between)));
    wants[pick(level.fruits)] = each * between;
  } else {
    const f = pick(level.fruits);
    const total = n(3, level.maxCount);
    const have = n(1, total - 1);
    wants[f] = total; already[f] = have;
  }
  return { kind, who, wants, between, already, patience: level.patience };
}

export type Basket = Partial<Record<Fruit, number>>;

export interface Verdict { ok: boolean; /** what is off, per fruit: positive means too many */ off: Partial<Record<Fruit, number>>; unequal: boolean }

/** Check the baskets against the order. For sharing, every basket must hold the same. */
export function check(order: Order, baskets: Basket[]): Verdict {
  const off: Partial<Record<Fruit, number>> = {};
  let ok = true, unequal = false;
  const total: Basket = {};
  for (const b of baskets) for (const f of FRUITS) if (b[f]) total[f] = (total[f] ?? 0) + (b[f] ?? 0);
  for (const f of FRUITS) {
    const want = order.wants[f] ?? 0, have = total[f] ?? 0;
    if (want !== have) { ok = false; off[f] = have - want; }
  }
  if (order.between > 1) {
    for (const f of FRUITS) {
      const counts = baskets.map(b => b[f] ?? 0);
      if (Math.max(...counts) !== Math.min(...counts)) { ok = false; unequal = true; }
    }
  }
  return { ok, off, unequal };
}

export function fruitName(f: Fruit, count: number, nl: boolean): string {
  const [se, pe, sn, pn] = FRUIT_NAME[f];
  return nl ? (count === 1 ? sn : pn) : (count === 1 ? se : pe);
}

/** Stars: nobody left unhappy, and hardly a wrong basket. */
export function starsFor(served: number, left: number, wrong: number, total: number): number {
  if (served < total * 0.5) return 0;
  if (left === 0 && wrong <= 1) return 3;
  if (left <= 1 && wrong <= 3) return 2;
  return 1;
}
