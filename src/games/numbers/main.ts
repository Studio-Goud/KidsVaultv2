import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Numbers } from './game';

const game = new Numbers(document.getElementById('numbers') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
