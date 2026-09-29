/**
 * Opening the space story, with the same page furniture as the other stories.
 */
import '../style.css';
import { addHomeButton } from '../hub/homebtn';
import { addGuideButton } from '../hub/guidebtn';
import { startClock } from '../platform/clock';
import { loadVoice } from '../platform/voice';
import { Ruimte } from './ruimte';

const story = new Ruimte(document.getElementById('satelliet') as HTMLCanvasElement);
addHomeButton();
loadVoice();
addGuideButton({ line: () => story.spoken() });
startClock();
