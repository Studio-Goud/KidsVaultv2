/**
 * Opening a journey.
 *
 * Every journey is its own page - one bundle, one entry in `vite.config.ts` - and every one of
 * them is these nine lines with a different piece of data passed in. The page furniture is the
 * same as every game's, because a child should not have to learn where the way out is twice.
 */

import '../style.css';
import { addBackButton, addHomeButton } from '../hub/homebtn';
import { addGuideButton } from '../hub/guidebtn';
import { startClock } from '../platform/clock';
import { loadVoice } from '../platform/voice';
import { JourneyScreen } from './screen';
import type { Journey } from './types';

export function startJourney(j: Journey): JourneyScreen {
  addHomeButton();
  const screen = new JourneyScreen(document.querySelector('canvas.full') as HTMLCanvasElement, j);
  addBackButton({ back: () => screen.back(), canBack: () => screen.canBack() });
  loadVoice();
  addGuideButton({ line: () => screen.spoken() });
  startClock();
  return screen;
}
