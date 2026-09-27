/**
 * The shape of a story journey's script, shared by every story.
 *
 * A step is one of: a line Ruth says (the story waits until she has finished), a wait for the child
 * to do something the scene knows about, a cue the scene acts on, or a short pause. There is no step
 * that times out and no step that can be failed.
 */

export type Step =
  | { say: string; sayNl: string }
  | { wait: string }
  | { cue: string }
  | { pause: number };

export interface Chapter {
  id: string;
  title: string;
  titleNl: string;
  steps: Step[];
}

export interface Aside { say: string; sayNl: string }

/** How long a line stays up when there is no voice at all, so a reading parent still gets it. */
export const readSeconds = (text: string): number => Math.max(1.6, text.split(/\s+/).length * 0.34);

/** Where a story is: which chapter, which step. */
export interface Place { chapter: number; step: number }

/** The step after this one, running on into the next chapter; null at the very end. */
export function nextPlaceIn(chapters: Chapter[], p: Place): Place | null {
  const c = chapters[p.chapter];
  if (p.step + 1 < c.steps.length) return { chapter: p.chapter, step: p.step + 1 };
  if (p.chapter + 1 < chapters.length) return { chapter: p.chapter + 1, step: 0 };
  return null;
}
