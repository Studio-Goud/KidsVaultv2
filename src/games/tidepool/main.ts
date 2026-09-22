import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Tidepool } from './game';
import { startClock } from '../../platform/clock';

const game = new Tidepool(document.getElementById('pool') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
startClock();
