import './../../style.css';
import { addHomeButton } from '../../hub/homebtn';
import { DinoDig } from './excavation';

new DinoDig(document.getElementById('dig') as HTMLCanvasElement);
addHomeButton();
