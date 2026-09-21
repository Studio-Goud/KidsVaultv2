/**
 * The spoken layer of Rekenrijk: a sum said out loud, in Dutch and in English.
 *
 * A child who has just moved eight apples and then five more has done the sum. The figures
 * "8 + 5 = 13" are a description of that, and the words are what carries it away from the screen -
 * so every sum in this game can be said as well as written, and the saying is a plain module with
 * no canvas in it.
 *
 * The Dutch is the awkward half and the reason this file exists. Dutch counts the units before the
 * tens ("vierentwintig" is four-and-twenty), and glues them together with "en" - except after a
 * word that already ends in an e, where the spelling takes a diaeresis: tweeëntwintig,
 * drieëndertig. Getting that wrong is the difference between a word a Dutch child reads and a word
 * they stumble over.
 */

const NL_ONES = [
  'nul', 'een', 'twee', 'drie', 'vier', 'vijf', 'zes', 'zeven', 'acht', 'negen', 'tien',
  'elf', 'twaalf', 'dertien', 'veertien', 'vijftien', 'zestien', 'zeventien', 'achttien', 'negentien',
];
const NL_TENS = ['', '', 'twintig', 'dertig', 'veertig', 'vijftig', 'zestig', 'zeventig', 'tachtig', 'negentig'];

const EN_ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * A whole number nought to a thousand, in words.
 *
 * Nothing in this game ever goes past a thousand - the worst a child can produce is the classic
 * "27 + 8 = 215", where the tens and the units were written down side by side - but that mistake
 * has to be sayable too, because it turns up as a wrong answer on a button.
 */
export function numberWord(n: number, nl: boolean): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  const k = Math.round(n);
  if (k >= 1000) return nl ? 'duizend' : 'one thousand';
  if (k >= 100) {
    const hundreds = Math.floor(k / 100), rest = k % 100;
    if (nl) {
      const head = hundreds === 1 ? 'honderd' : `${NL_ONES[hundreds]}honderd`;
      return rest === 0 ? head : `${head}${numberWord(rest, true)}`;
    }
    const head = `${EN_ONES[hundreds]} hundred`;
    return rest === 0 ? head : `${head} and ${numberWord(rest, false)}`;
  }
  if (k < 20) return nl ? NL_ONES[k] : EN_ONES[k];
  const tens = Math.floor(k / 10), unit = k % 10;
  if (unit === 0) return nl ? NL_TENS[tens] : EN_TENS[tens];
  if (!nl) return `${EN_TENS[tens]}-${EN_ONES[unit]}`;
  const one = NL_ONES[unit];
  // twee and drie already end in an e, so the glue takes the diaeresis: tweeëntwintig
  return `${one}${one.endsWith('e') ? 'ën' : 'en'}${NL_TENS[tens]}`;
}

/** The symbols: what a child would copy into an exercise book. */
export function sumSymbols(op: string, a: number, b: number, answer: number): string {
  switch (op) {
    case 'split': return `${a} = ${b} + ${answer}`;
    case 'sub': return `${a} − ${b} = ${answer}`;
    case 'diff': return `${b} − ${a} = ${answer}`;
    case 'times': return `${a} × ${b} = ${answer}`;
    default: return `${a} + ${b} = ${answer}`;
  }
}

/**
 * The same sum in words, in the wording a Dutch classroom uses.
 *
 * "Splitsen", "erbij", "eraf", "keer" are not translations of English maths words, they are the
 * words on the worksheet, and a child who hears them here hears them again at school.
 */
export function sumWords(op: string, a: number, b: number, answer: number, nl: boolean): string {
  const w = (n: number): string => numberWord(n, nl);
  switch (op) {
    case 'split':
      return nl ? `${w(a)} is ${w(b)} en ${w(answer)}` : `${w(a)} is ${w(b)} and ${w(answer)}`;
    case 'sub':
      return nl ? `${w(a)} min ${w(b)} is ${w(answer)}` : `${w(a)} take away ${w(b)} is ${w(answer)}`;
    case 'diff':
      return nl ? `van ${w(a)} naar ${w(b)} is ${w(answer)} erbij` : `from ${w(a)} to ${w(b)} is ${w(answer)} more`;
    case 'times':
      return nl ? `${w(a)} keer ${w(b)} is ${w(answer)}` : `${w(a)} times ${w(b)} is ${w(answer)}`;
    default:
      return nl ? `${w(a)} plus ${w(b)} is ${w(answer)}` : `${w(a)} plus ${w(b)} is ${w(answer)}`;
  }
}
