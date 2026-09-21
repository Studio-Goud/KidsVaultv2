/**
 * Which way a walker tries to go when it is standing on a square.
 *
 * The hedgehog goes where it is being asked to go and nowhere else: hold a direction and it keeps
 * walking, let go and it stops on the next square. It used to carry on in its last direction the
 * way a Bomberman character does, which meant one tap sent a child skidding across the board and
 * into a puffball - and at this age that is the whole of the frustration.
 *
 * A mole is not being steered, so a mole still carries on by itself.
 *
 * Kept in its own file with no imports so it can be checked on its own.
 */

export interface Dir { x: number; y: number }

/** The directions to try, in order, for a walker standing on a square. */
export function stepDirections(steered: boolean, want: Dir, carryOn: Dir): Dir[] {
  const tries = steered ? [want] : [want, carryOn];
  return tries.filter(d => d.x !== 0 || d.y !== 0);
}
