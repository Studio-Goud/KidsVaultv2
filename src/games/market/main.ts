import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { MarketDay } from './game';
import { startClock } from '../../platform/clock';

const game = new MarketDay(document.getElementById('stall') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
startClock();
