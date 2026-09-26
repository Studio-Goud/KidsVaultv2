/**
 * The shape of a discovery journey.
 *
 * A journey is the one format in Suri that is not a game. You get into something, you press
 * start, and it carries you. Every so often it stops, the guide says one thing, and you decide
 * whether you want to hear more or go on. Nothing is asked of you and nothing can go wrong, which
 * is the point: it is the thing to open when a child wants to be shown rather than tested.
 *
 * The format is data, not code, because the same engine has to carry the solar system, a dive to
 * the bottom of the sea, the age of the dinosaurs, a trip through a body and a walk through a
 * factory. What changes between those is a list of stops, the colours between them, the scale
 * along the side and what you are riding in. Everything else - the travelling, the holding, the
 * asking for more, the browsing afterwards - is the same, and is written once.
 *
 * ## Why every stop has a photograph or a drawing and not both
 *
 * `docs/research.md` §2.3: what a young child takes from a picture is the picture. A real
 * photograph of Neptune and a drawn cartoon of Neptune in the same frame teach two different
 * things and the drawn one wins, because it is easier to look at. So a stop is either a real
 * image or a drawn one, and the drawn ones are silhouettes rather than characters.
 */

/** One extra thing, for a child who taps for more. Each is one breath. */
export interface Beat {
  say: string;
  sayNl: string;
}

/** Somewhere worth stopping. */
export interface Stop {
  id: string;
  /**
   * Where it lies along the route, 0 at the start and 1 at the end. These set the pace of the
   * journey rather than its truth: the number on the gauge comes from `reading`, which runs
   * between the stops, so a route can put its stops evenly apart on the screen and still count
   * in real metres or real millions of kilometres.
   */
  at: number;
  title: string;
  titleNl: string;
  /** what the guide says on arrival: one sentence, out loud */
  say: string;
  sayNl: string;
  /** more, one tap at a time, in the order a child would ask */
  more: Beat[];
  /** the world's colour here; the background runs from one stop's tone to the next */
  tone: string;
  /**
   * The picture. `planet` and `moon` are the ones that ship with the app; `remote` is a path on
   * Wikimedia Commons, fetched when it is needed; `drawn` is the journey's own art, drawn inside
   * a circle of radius `r` around the origin; `none` is a plain disc in the world's colour, which
   * is what a stop that is a place rather than a thing gets.
   */
  picture:
    | { kind: 'planet' | 'moon'; id: string }
    | { kind: 'remote'; path: string; credit: string }
    | { kind: 'drawn'; art: (ctx: CanvasRenderingContext2D, r: number) => void }
    | { kind: 'none' };
  /** the reading on the gauge here: metres down, millions of kilometres out, years ago */
  mark: number;
}

/** What you are riding in. Each is a drawing; the engine knows how to point it along the route. */
export type Craft = 'rocket' | 'sub' | 'pod' | 'drill';

export interface Journey {
  id: string;
  title: string;
  titleNl: string;
  /** the line the guide says before you set off */
  opening: string;
  openingNl: string;
  /** and the one at the end */
  closing: string;
  closingNl: string;
  craft: Craft;
  /** which way the route runs on the screen */
  axis: 'down' | 'up';
  /** what the gauge counts, for the label beside the number */
  unit: string;
  unitNl: string;
  /** stops in order, the first at 0 and the last at 1 */
  stops: Stop[];
  /** where a `remote` picture path hangs off */
  photoBase?: string;
}
