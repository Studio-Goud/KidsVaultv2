import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Kiekeboe } from './game';
import { startClock } from '../../platform/clock';
import { loadVoice } from '../../platform/voice';
import { addGuideButton } from '../../hub/guidebtn';

const game = new Kiekeboe(document.getElementById('kiekeboe') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
loadVoice();
addGuideButton({ line: () => game.spoken() });
startClock();
