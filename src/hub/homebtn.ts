/** A way back to Bramblewood from inside a game. Every game page adds one. */
export function addHomeButton(): void {
  const nl = (navigator.language || 'en').toLowerCase().startsWith('nl');
  const a = document.createElement('a');
  a.className = 'homebtn';
  a.href = './';
  a.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M15 5 L8 12 L15 19"/></svg>' + (nl ? 'Bramblewood' : 'Bramblewood');
  document.body.appendChild(a);
}
