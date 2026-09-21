/**
 * The way back to Bramblewood, and it is the same button in every game.
 *
 * It used to be a pill with the word "Bramblewood" in it, which meant nine games had a piece of
 * text you had to be able to read before you could get out of them. It is a round button with a
 * house on it now, in the same corner, the same size, in every game on the site.
 */
export function addHomeButton(): void {
  const nl = (navigator.language || 'en').toLowerCase().startsWith('nl');
  const a = document.createElement('a');
  a.className = 'homebtn';
  a.href = './';
  a.setAttribute('aria-label', nl ? 'Terug naar Bramblewood' : 'Back to Bramblewood');
  a.title = nl ? 'Terug naar Bramblewood' : 'Back to Bramblewood';
  a.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M3 11.2 12 4l9 7.2"/><path d="M5.6 10v9.2h12.8V10"/>' +
    '<path d="M9.8 19.2v-5h4.4v5"/></svg>';
  document.body.appendChild(a);
}
