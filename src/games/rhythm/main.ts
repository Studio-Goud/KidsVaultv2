import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Rhythm } from './game';
import { startClock } from '../../platform/clock';

const game = new Rhythm(document.getElementById('rhythm') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
startClock();
