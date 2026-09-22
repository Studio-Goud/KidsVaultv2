import '../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Moonshot } from './game';
import { startClock } from '../../platform/clock';
import { loadVoice } from '../../platform/voice';

addHomeButton();
const game = new Moonshot(document.getElementById('pad') as HTMLCanvasElement);
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
loadVoice();
startClock();
