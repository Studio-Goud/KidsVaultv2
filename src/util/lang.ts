import { save } from './storage';

/**
 * Which language the app is speaking, and nothing else.
 *
 * This used to live in `i18n.ts` next to Cloudhopper's five hundred strings, so a game that wanted
 * to know the language had to pull the whole dictionary into its bundle. Twelve of the fifteen
 * games solved that by reading `navigator.language` themselves - which meant the language switch
 * in the settings did nothing for them, and a parent who chose Dutch on an English phone got
 * twelve games in English.
 *
 * So it is its own module now: one function, no strings, nothing to carry.
 */
export function lang(): 'nl' | 'en' {
  if (save.lang !== 'auto') return save.lang;
  return (navigator.language || 'en').toLowerCase().startsWith('nl') ? 'nl' : 'en';
}

/** Dutch or not, for the `T(en, nl)` pairs the games are written with. */
export const NL = (): boolean => lang() === 'nl';

/** One of two strings, in the language the app is speaking. */
export const T = (en: string, nl: string): string => (NL() ? nl : en);
