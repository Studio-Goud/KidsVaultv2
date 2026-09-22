import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Millstream } from './game';
import { startClock } from '../../platform/clock';

const game = new Millstream(document.getElementById('valley') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
startClock();
