import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { NightWatch } from './game';

const canvas = document.getElementById('sky') as HTMLCanvasElement;
const game = new NightWatch(canvas);
addHomeButton();
addBackButton({ back: () => game.back(), canBack: () => game.canBack() });
