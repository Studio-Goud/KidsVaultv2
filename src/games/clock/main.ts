import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Clock } from './game';
import { startClock } from '../../platform/clock';
import { loadVoice } from '../../platform/voice';

const game = new Clock(document.getElementById('clock') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
loadVoice();
startClock();
