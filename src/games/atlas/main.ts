import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Atlas } from './game';
import { startClock } from '../../platform/clock';

const game = new Atlas(document.getElementById('atlas') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
startClock();
