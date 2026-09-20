import './../../style.css';
import { addHomeButton } from '../../hub/homebtn';
import { Millstream } from './game';

new Millstream(document.getElementById('valley') as HTMLCanvasElement);
addHomeButton();
