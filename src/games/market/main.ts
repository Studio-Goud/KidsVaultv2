import './../../style.css';
import { addHomeButton } from '../../hub/homebtn';
import { MarketDay } from './game';

new MarketDay(document.getElementById('stall') as HTMLCanvasElement);
addHomeButton();
