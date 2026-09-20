/**
 * One scale factor for every game's own interface.
 *
 * A phone is the reference. A tablet or a laptop has more room in every direction, so headings,
 * buttons and play areas grow with it instead of staying at phone size in the middle of a big
 * screen. The height counts for less than the width, because a wide short window should not blow
 * the text up past what fits.
 */
export function uiScale(w: number, h: number): number {
  const k = Math.min(w, h * 0.72) / 390;
  return Math.max(1, Math.min(2.2, k));
}
