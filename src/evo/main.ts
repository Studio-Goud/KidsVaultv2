/**
 * Opening Van cel tot mens, with the same page furniture as every other page.
 */
import '../style.css';
import { addHomeButton } from '../hub/homebtn';
import { addGuideButton } from '../hub/guidebtn';
import { startClock } from '../platform/clock';
import { loadVoice } from '../platform/voice';
import { Evo } from './evo';

const evo = new Evo(document.getElementById('evolutie') as HTMLCanvasElement);
addHomeButton();
loadVoice();
addGuideButton({ line: () => evo.spoken() });
startClock();
