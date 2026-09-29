/**
 * Opening the tummy-ache story, with the same page furniture as the other stories.
 */
import '../style.css';
import { addHomeButton } from '../hub/homebtn';
import { addGuideButton } from '../hub/guidebtn';
import { startClock } from '../platform/clock';
import { loadVoice } from '../platform/voice';
import { Buik } from './buik';

const story = new Buik(document.getElementById('buikpijn') as HTMLCanvasElement);
addHomeButton();
loadVoice();
addGuideButton({ line: () => story.spoken() });
startClock();
