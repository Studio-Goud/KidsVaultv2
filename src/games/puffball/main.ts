import '../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Puffball } from './game';
import { startClock } from '../../platform/clock';
import { loadVoice } from '../../platform/voice';
import { addGuideButton } from '../../hub/guidebtn';

addHomeButton();
const game = new Puffball(document.getElementById('wood') as HTMLCanvasElement);
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
loadVoice();
addGuideButton({ line: () => game.spoken() });
startClock();
