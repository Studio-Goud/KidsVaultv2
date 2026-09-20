import './../../style.css';
import { addHomeButton } from '../../hub/homebtn';
import { Tidepool } from './game';

new Tidepool(document.getElementById('pool') as HTMLCanvasElement);
addHomeButton();
