import './../../style.css';
import { addHomeButton } from '../../hub/homebtn';
import { DinoDig } from './game';

new DinoDig(document.getElementById('dig') as HTMLCanvasElement);
addHomeButton();
