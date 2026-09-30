/**
 * A number written out the way a Dutch voice should say it.
 *
 * `voicehear.mjs` caught the speech engine misreading digits: "228 miljoen" came out as twenty-two
 * million, "375" as fifty-three, and a decimal comma now and then as a pause. Words leave it nothing
 * to guess. The rules are the ordinary Dutch ones: units before tens joined with "en" (with a
 * trema after twee and drie), hundreds and thousands written together, 1100 to 9999 said in
 * hundreds the way a Dutch speaker says a year or a speed ("negentienhonderdnegenenzestig"), a
 * decimal comma said as "komma" with the part after it read as a number.
 */
const UNITS_NL = ['nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien', 'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien'];
const TENS_NL = ['', '', 'twintig', 'dertig', 'veertig', 'vijftig', 'zestig', 'zeventig', 'tachtig', 'negentig'];
export function nlWords(n) {
  if (n < 20) return UNITS_NL[n];
  if (n < 100) {
    const t = Math.floor(n / 10), u = n % 10;
    if (!u) return TENS_NL[t];
    const unit = UNITS_NL[u];
    return `${unit}${/e$/.test(unit) ? 'ën' : 'en'}${TENS_NL[t]}`;
  }
  if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return `${h === 1 ? '' : UNITS_NL[h]}honderd${r ? nlWords(r) : ''}`; }
  if (n < 10000 && n % 1000 !== 0 && n >= 1100 && Math.floor(n / 100) % 10 !== 0) {
    const h = Math.floor(n / 100), r = n % 100; return `${nlWords(h)}honderd${r ? nlWords(r) : ''}`;
  }
  if (n < 1000000) { const k = Math.floor(n / 1000), r = n % 1000; return `${k === 1 ? '' : nlWords(k)}duizend${r ? (r < 100 ? ' ' : '') + nlWords(r) : ''}`; }
  const m = Math.floor(n / 1000000), r = n % 1000000;
  return `${nlWords(m)} miljoen${r ? ' ' + nlWords(r) : ''}`;
}
export function nlNumbers(text) {
  return text
    // a price: €3,99 is drie euro negenennegentig
    .replace(/€\s?(\d+),(\d{2})\b/g, (_, e, c) => `${nlWords(+e)} euro ${nlWords(+c)}`)
    // the time on a clock: 13:00 is dertien uur, 13:30 is dertien uur dertig
    .replace(/\b(\d{1,2}):(\d{2})\b/g, (_, h, m) => `${nlWords(+h)} uur${+m ? ' ' + nlWords(+m) : ''}`)
    // any other number standing on its own (not glued to letters, like "17-year")
    .replace(/(^|[^\p{L}\d-])(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(?![\p{L}\d-])/gu, (_, pre, int, dec) => {
      const n = Number(int.replace(/\./g, ''));
      const whole = n === 1 && !dec ? 'één' : nlWords(n);
      return `${pre}${whole}${dec !== undefined ? ' komma ' + (dec.length > 1 && dec[0] === '0' ? [...dec].map(d => UNITS_NL[+d]).join(' ') : nlWords(+dec)) : ''}`;
    });
}

