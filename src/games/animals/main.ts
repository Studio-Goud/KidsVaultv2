import './../../style.css';
import { addBackButton, addHomeButton } from '../../hub/homebtn';
import { AnimalBook } from './book';
import { startClock } from '../../platform/clock';

const book = new AnimalBook(document.getElementById('book') as HTMLCanvasElement);
addHomeButton();
addBackButton({ back: () => book.back(), canBack: () => book.canBack() });
startClock();
