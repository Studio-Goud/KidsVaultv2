import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Orbit } from './game';
import { startClock } from '../../platform/clock';
import { loadVoice } from '../../platform/voice';

const game = new Orbit(document.getElementById('space') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
loadVoice();
startClock();
