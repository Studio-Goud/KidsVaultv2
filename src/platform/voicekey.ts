/**
 * The name a spoken line is filed under when it has been recorded.
 *
 * Most of the app does not name its lines: a game says `speakLine(text)` and nothing more. So a
 * recording is filed under the words themselves, turned into a short key, and the app and the
 * script that renders the recordings (`scripts/voice.mjs`) both work that key out the same way
 * from this one file. Change the words of a line and it simply stops finding its recording, and
 * falls back to the device's voice until the script is run again - which is the right failure: the
 * child hears the new words, not the old ones.
 *
 * Kept free of anything that needs a browser, so the script and the tests can import it.
 */

/** Spacing and line breaks do not change what is said, so they do not change the key. */
export const normalLine = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** FNV-1a over the normalised line: short, stable, and the same in Node and in a browser. */
export function lineKey(text: string): string {
  const s = normalLine(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `t${h.toString(16).padStart(8, '0')}`;
}

/**
 * The key for a piece of radio talk. Cloudhopper puts its radio calls together from pieces -
 * a callsign, "cleared to land runway", two digits, "wind", a number - so they are matched without
 * case or punctuation: "Tower," at the end of a phrase is the same recording as "tower" inside one.
 */
export const radioWords = (text: string): string[] =>
  text.toLowerCase().replace(/[.,!?:;]/g, ' ').split(/\s+/).filter(Boolean);

export const radioKey = (words: string | string[]): string =>
  lineKey((Array.isArray(words) ? words : radioWords(words)).join(' '));
