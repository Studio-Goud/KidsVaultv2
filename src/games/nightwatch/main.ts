import './../../style.css';
import { addHomeButton } from '../../hub/homebtn';
import { NightWatch } from './game';

const canvas = document.getElementById('sky') as HTMLCanvasElement;
new NightWatch(canvas);
addHomeButton();
