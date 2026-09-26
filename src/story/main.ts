/**
 * Opening the story journey. The page furniture is the same as every other page's, so a child
 * finds the way home and the guide in the same corners.
 */
import '../style.css';
import { addHomeButton } from '../hub/homebtn';
import { addGuideButton } from '../hub/guidebtn';
import { startClock } from '../platform/clock';
import { loadVoice } from '../platform/voice';
import { Story } from './game';

const story = new Story(document.getElementById('tand') as HTMLCanvasElement);
addHomeButton();
loadVoice();
addGuideButton({ line: () => story.spoken() });
startClock();
