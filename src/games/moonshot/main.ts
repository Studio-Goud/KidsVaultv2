import '../../style.css';
import { addHomeButton } from '../../hub/homebtn';
import { Moonshot } from './game';

addHomeButton();
new Moonshot(document.getElementById('pad') as HTMLCanvasElement);
