import './../../style.css';
import { NightWatch } from './game';

const canvas = document.getElementById('sky') as HTMLCanvasElement;
new NightWatch(canvas);
