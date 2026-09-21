import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Clock } from './game';

const game = new Clock(document.getElementById('clock') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
