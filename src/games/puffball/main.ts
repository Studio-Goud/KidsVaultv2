import '../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { Puffball } from './game';

addHomeButton();
const game = new Puffball(document.getElementById('wood') as HTMLCanvasElement);
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
