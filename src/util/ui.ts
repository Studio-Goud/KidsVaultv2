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
 * read these since the beginning; this is the same numbers for the rest of Suri.
 */
export interface SafeArea { top: number; bottom: number; left: number; right: number }

let cached: SafeArea | null = null;

/**
 * Measured off a real property rather than read out of a variable.
 *
 * `--sat` is `env(safe-area-inset-top)`, and asking `getComputedStyle` for a custom property does
 * not give you the same answer everywhere: Chromium substitutes the `env()` and hands back "59px",
 * WebKit hands back the text "env(safe-area-inset-top, 0px)", which `parseFloat` turns into
 * nothing. So on an iPhone the stylesheet placed the buttons correctly at 61 pixels down and the
 * canvas drew its own at nothing, and the two sat on top of each other - on every screen in
 * Suri, and never once on the machine this was written on.
 *
 * Padding is not a custom property. It is always computed to pixels, in every engine, and the
 * probe carries its own inline style so it does not need the stylesheet to have loaded yet.
 */
function measure(): SafeArea {
  const px = (v: string): number => {
    const n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : 0;
  };
  const probe = document.createElement('div');
  probe.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'width:0', 'height:0',
    'visibility:hidden', 'pointer-events:none',
    'padding-top:env(safe-area-inset-top,0px)',
    'padding-bottom:env(safe-area-inset-bottom,0px)',
    'padding-left:env(safe-area-inset-left,0px)',
    'padding-right:env(safe-area-inset-right,0px)',
  ].join(';');
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const out: SafeArea = {
    top: px(cs.paddingTop), bottom: px(cs.paddingBottom),
    left: px(cs.paddingLeft), right: px(cs.paddingRight),
  };
  probe.remove();

  // and if the probe found nothing, the variables are worth a look: a browser that resolves them
  // is a browser that may have them when a bare env() in an inline style did not survive a policy
  if (!out.top && !out.bottom && !out.left && !out.right) {
    const root = getComputedStyle(document.documentElement);
    out.top = px(root.getPropertyValue('--sat'));
    out.bottom = px(root.getPropertyValue('--sab'));
    out.left = px(root.getPropertyValue('--sal'));
    out.right = px(root.getPropertyValue('--sar'));
  }
  return out;
}

export function safeArea(): SafeArea {
  // A notch cannot be emulated by a desktop browser, so the audit hands one over instead. Without
  // this there is no way to test the one case that has actually gone wrong on a real phone.
  const forced = (window as unknown as { __insets?: Partial<SafeArea> }).__insets;
  if (forced) {
    return {
      top: forced.top ?? 0, bottom: forced.bottom ?? 0,
      left: forced.left ?? 0, right: forced.right ?? 0,
    };
  }
  if (!cached) cached = measure();
  return cached;
}

/** The insets change when the phone is turned, so they are read again on a resize. */
if (typeof window !== 'undefined') {
  const forget = (): void => { cached = null; };
  window.addEventListener('resize', forget);
  window.addEventListener('orientationchange', forget);
  // A phone that reports its notch a beat after the page opens used to be stuck with nothing for
  // the rest of the session, because the answer was worked out once and kept.
  window.addEventListener('load', forget);
  window.addEventListener('pageshow', forget);
}
