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

/**
 * How much of the screen the phone itself has taken: the notch and status bar at the top, the
 * home indicator at the bottom. Every page sets `viewport-fit=cover`, so the art runs edge to
 * edge under them - but nothing a child has to read or press may. Cloudhopper's renderer has
 * read these since the beginning; this is the same numbers for the rest of Braambos.
 */
export interface SafeArea { top: number; bottom: number; left: number; right: number }

let cached: SafeArea | null = null;

export function safeArea(): SafeArea {
  if (cached) return cached;
  const cs = getComputedStyle(document.documentElement);
  const px = (v: string): number => parseFloat(v) || 0;
  cached = {
    top: px(cs.getPropertyValue('--sat')),
    bottom: px(cs.getPropertyValue('--sab')),
    left: px(cs.getPropertyValue('--sal')),
    right: px(cs.getPropertyValue('--sar')),
  };
  return cached;
}

/** The insets change when the phone is turned, so they are read again on a resize. */
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => { cached = null; });
  window.addEventListener('orientationchange', () => { cached = null; });
}
