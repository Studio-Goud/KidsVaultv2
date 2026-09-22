/**
 * The way back to Braambos, and it is the same button in every game.
 *
 * It used to be a pill with the word "Braambos" in it, which meant nine games had a piece of
 * text you had to be able to read before you could get out of them. It is a round button with a
 * house on it now, in the same corner, the same size, in every game on the site.
 */
/**
 * Put the forced insets on the page as well, so the buttons the stylesheet places and the chrome
 * the canvas draws are measured against the same edge during an audit.
 */
function applyForcedInsets(): void {
  const f = (window as unknown as { __insets?: Record<string, number> }).__insets;
  if (!f) return;
  const r = document.documentElement.style;
  for (const [k, v] of [['--sat', f.top], ['--sab', f.bottom], ['--sal', f.left], ['--sar', f.right]] as const) {
    r.setProperty(k, `${v ?? 0}px`);
  }
}

export function addHomeButton(): void {
  applyForcedInsets();
  const nl = (navigator.language || 'en').toLowerCase().startsWith('nl');
  const a = document.createElement('a');
  a.className = 'homebtn';
  a.href = './';
  a.setAttribute('aria-label', nl ? 'Terug naar Braambos' : 'Back to Braambos');
  a.title = nl ? 'Terug naar Braambos' : 'Back to Braambos';
  a.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 11.2 12 4l9 7.2"/><path d="M5.6 10v9.2h12.8V10"/>' +
    '<path d="M9.8 19.2v-5h4.4v5"/></svg>';
  document.body.appendChild(a);
}

/**
 * One step back, and it is the same button in every game.
 *
 * Every game had its own way of getting out of a level, or none at all: a word drawn on the canvas,
 * a corner you had to know about, or nothing, so the only way back was to leave the game entirely.
 * This is the same round button as the way home, beside it, in every game, and it goes back exactly
 * one screen. It hides itself when there is nothing to go back to.
 */
export function addBackButton(opts: { back: () => void; canBack: () => boolean }): void {
  const nl = (navigator.language || 'en').toLowerCase().startsWith('nl');
  const b = document.createElement('button');
  b.className = 'homebtn backbtn';
  b.type = 'button';
  b.setAttribute('aria-label', nl ? 'Terug' : 'Back');
  b.title = nl ? 'Terug' : 'Back';
  b.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M15 5 8 12l7 7"/></svg>';
  b.addEventListener('click', e => { e.preventDefault(); opts.back(); });
  document.body.appendChild(b);
  const sync = (): void => { b.style.display = opts.canBack() ? 'grid' : 'none'; };
  sync();
  setInterval(sync, 200);
}
