import './../../style.css';
import { addHomeButton } from '../../hub/homebtn';
import { Orbit } from './game';

new Orbit(document.getElementById('space') as HTMLCanvasElement);
addHomeButton();
