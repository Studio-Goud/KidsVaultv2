import '../../style.css';
import { addHomeButton } from '../../hub/homebtn';
import { Puffball } from './game';

addHomeButton();
new Puffball(document.getElementById('wood') as HTMLCanvasElement);
