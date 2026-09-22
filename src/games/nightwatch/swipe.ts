/**
 * What one finger means, with no canvas and no events in it.
 *
 * Night Watch used to want a separate drag per line: press a star, pull to the next, let go, press
 * again. That is four gestures for a four-line figure and it does not feel like drawing anything.
 * A child draws a constellation the way they draw a shape - one press, one movement through every
 * star, one release - so that is what this works out: which star a point is on, and what happens to
 * the run of stars the finger has been through when it reaches the next one.
 *
 * Three things it has to get right, and all three are about what a finger expects:
 *
 *  - Lifting between stars must not punish anybody. A press that never moves leaves that star
 *    waiting as an anchor, and the next press anywhere else links to it. Tap, tap is the same
 *    as press, drag, release, and a child who does both in one figure never notices.
 *  - Passing back over the star before last takes the line away again, because that is what pulling
 *    a finger back means everywhere else.
 *  - Between two stars, nothing. The reach is deliberately generous, which means a point can be
 *    inside two stars' reach at once; rather than guess, this waits until the finger is clearly
 *    nearer one of them. A wrong line drawn for you is worse than a line not yet drawn.
 */

import { AMBIGUOUS_SHARE } from './sky';

export interface Pt { x: number; y: number }

/**
 * The star a point is on, or null.
 *
 * Null for two different reasons, and they feel the same to the child: the finger is not near any
 * star, or it is near two and has not chosen. `slack` is how much nearer the winner has to be, as a
 * share of the reach - a tie inside that band is a refusal, never a coin toss.
 */
export function starAt(
  p: Pt, stars: ReadonlyArray<Pt>, grab: number, slack = AMBIGUOUS_SHARE,
): number | null {
  let best = -1, bd = Infinity, second = Infinity;
  for (let i = 0; i < stars.length; i++) {
    const d = Math.hypot(stars[i].x - p.x, stars[i].y - p.y);
    if (d < bd) { second = bd; bd = d; best = i; }
    else if (d < second) second = d;
  }
  if (best < 0 || bd > grab) return null;
  if (second <= grab && second - bd < grab * slack) return null;
  return best;
}

/**
 * `add` a new line, `remove` a line taken away by drawing over it again, `undo` a line pulled back
 * off the end of the run, `pass` a line the run crossed that was already there, `start` the first
 * star of a press, `none` nothing at all.
 */
export type SwipeEvent = 'none' | 'start' | 'add' | 'undo' | 'remove' | 'pass';

/** Where one finger has got to. Empty path means no finger is down. */
export interface Hand {
  /** the stars this press has run through, in order */
  path: number[];
  /** how many lines this press has already changed; the first one is the one allowed to toggle */
  links: number;
  /** a star left waiting by a finger that lifted without going anywhere */
  anchor: number | null;
}

export const EMPTY_HAND: Hand = { path: [], links: 0, anchor: null };

export interface Move {
  hand: Hand;
  event: SwipeEvent;
  /** the two stars of the line that was added, removed or undone */
  a?: number;
  b?: number;
}

const none = (hand: Hand): Move => ({ hand, event: 'none' });

/**
 * A finger going down.
 *
 * On empty sky it clears whatever was waiting - a press somewhere else is a child changing their
 * mind, not an accident. On a star, it either closes the line the last tap left open, or starts a
 * fresh run.
 */
export function press(h: Hand, hit: number | null, has: (a: number, b: number) => boolean): Move {
  if (hit === null) return none({ path: [], links: 0, anchor: null });
  if (h.anchor !== null && h.anchor !== hit) {
    const a = h.anchor;
    const was = has(a, hit);
    return { hand: { path: [hit], links: 1, anchor: null }, event: was ? 'remove' : 'add', a, b: hit };
  }
  return { hand: { path: [hit], links: 0, anchor: null }, event: 'start', a: hit };
}

/**
 * A finger moving.
 *
 * The first line of a press may toggle: drawing over a line you already have takes it away, which
 * is how a mistake was undone before swiping existed and how it is still undone by a single drag.
 * After that first line the run only ever adds, because a long stroke that quietly deleted a line
 * it happened to cross would be unreadable.
 */
export function move(h: Hand, hit: number | null, has: (a: number, b: number) => boolean): Move {
  if (hit === null || h.path.length === 0) return none(h);
  const path = h.path;
  const last = path[path.length - 1];
  if (hit === last) return none(h);

  if (path.length >= 2 && hit === path[path.length - 2]) {
    return {
      hand: { path: path.slice(0, -1), links: h.links + 1, anchor: null },
      event: 'undo', a: last, b: hit,
    };
  }
  const next = { path: [...path, hit], links: h.links + 1, anchor: null };
  if (has(last, hit)) {
    return h.links === 0
      ? { hand: { path: [hit], links: 1, anchor: null }, event: 'remove', a: last, b: hit }
      : { hand: next, event: 'pass', a: last, b: hit };
  }
  return { hand: next, event: 'add', a: last, b: hit };
}

/**
 * A finger lifting.
 *
 * A press that touched one star and changed nothing leaves that star waiting, so the next tap
 * anywhere finishes the line. Anything else is a finished stroke and leaves nothing behind.
 */
export function lift(h: Hand): Hand {
  const anchor = h.path.length === 1 && h.links === 0 ? h.path[0] : null;
  return { path: [], links: 0, anchor };
}

/** How long the run under the finger is, which is what the rising note is pitched off. */
export const runLength = (h: Hand): number => Math.max(0, h.path.length - 1);
