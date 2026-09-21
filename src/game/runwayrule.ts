/**
 * When is a runway clear enough for the next arrival?
 *
 * A tower does not wait for a strip to be empty before clearing the next aircraft onto it. It
 * waits until the one ahead is far enough down it to be out of the way, and then brings the next
 * one in behind. Holding everyone off until the aircraft ahead has finished its roll-out and
 * taxied clear is realistic for a single-runway regional field and miserable to play: arrivals
 * stack up and go around for a runway that has been effectively empty for twenty seconds.
 *
 * A quarter of the way along is the point where a child looking at the screen can see there is
 * room. Departures are deliberately not covered by this - an aircraft about to accelerate from a
 * standstill needs the whole strip - so they still wait for the runway to be properly free.
 *
 * Kept in its own file with no imports so it can be checked on its own.
 */

/** How far down the roll-out the aircraft ahead must be before the next one may be cleared in. */
export const CLEAR_BEHIND_AT = 0.25;

export interface RollingAhead {
  state: string;
  /** the runway it is rolling down, if it is on one */
  runway: string | null;
  /** 0 at the threshold, 1 at the far end */
  landingT: number;
}

/**
 * True when another arrival must be sent around rather than cleared onto this strip.
 *
 * `occupiedBy` is the id currently holding the runway, `me` the aircraft asking for it, and
 * `ahead` whatever aircraft that id refers to, if it is still in the world.
 */
export function stripBusyFor(
  occupiedBy: number | null,
  me: number,
  ahead: RollingAhead | undefined,
  runwayId: string,
): boolean {
  if (occupiedBy === null || occupiedBy === me) return false;
  if (!ahead) return false;
  const rolling = ahead.state === 'landing' && ahead.runway === runwayId;
  return !(rolling && ahead.landingT > CLEAR_BEHIND_AT);
}
