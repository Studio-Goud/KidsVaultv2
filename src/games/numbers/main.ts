import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Numbers } from './game';
import { startClock } from '../../platform/clock';
import { loadVoice } from '../../platform/voice';

const game = new Numbers(document.getElementById('numbers') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
loadVoice();
startClock();
