import '../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Moonshot } from './game';
import { startClock } from '../../platform/clock';

addHomeButton();
const game = new Moonshot(document.getElementById('pad') as HTMLCanvasElement);
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
startClock();
