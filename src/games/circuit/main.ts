import '../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Circuit } from './game';

const game = new Circuit(document.getElementById('bench') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
