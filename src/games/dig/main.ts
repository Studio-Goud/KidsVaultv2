import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { DinoDig } from './excavation';

const game = new DinoDig(document.getElementById('dig') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
