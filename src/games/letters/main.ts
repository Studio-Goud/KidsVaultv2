import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Letters } from './game';
import { startClock } from '../../platform/clock';

const game = new Letters(document.getElementById('letters') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
startClock();
