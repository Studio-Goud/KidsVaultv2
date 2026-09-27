/**
 * Opening the second story journey, with the same page furniture as the first.
 */
import '../style.css';
import { addHomeButton } from '../hub/homebtn';
import { addGuideButton } from '../hub/guidebtn';
import { startClock } from '../platform/clock';
import { loadVoice } from '../platform/voice';
import { Licht } from './licht';

const story = new Licht(document.getElementById('lichtje') as HTMLCanvasElement);
addHomeButton();
loadVoice();
addGuideButton({ line: () => story.spoken() });
startClock();
