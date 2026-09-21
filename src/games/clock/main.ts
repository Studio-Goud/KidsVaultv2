import './../../style.css';
import { addHomeButton } from '../../hub/homebtn';
import { Clock } from './game';

new Clock(document.getElementById('clock') as HTMLCanvasElement);
addHomeButton();
