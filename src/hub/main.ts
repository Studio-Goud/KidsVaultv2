/**
 * Bramblewood, the front door.
 *
 * One page that holds every game in the world, says in a line what each one practises, and carries
 * the promise the whole thing rests on: no advertising, no tracking, and a session that ends.
 */

import '../style.css';
import { drawPlaneThumb, drawStarsThumb } from './thumbs';

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);

interface Game {
  href: string;
  title: string;
  line: string;
  lineNl: string;
  practises: string;
  practisesNl: string;
  age: string;
  /** either a photograph we already ship, or a thumbnail we draw */
  img?: string;
  /** backdrop behind a photograph that has its own background */
  tint?: string;
  paint?: (c: HTMLCanvasElement) => void;
}

const GAMES: Game[] = [
  {
    href: './cloudhopper.html',
    title: 'Cloudhopper',
    line: 'Draw a route for every incoming aircraft and bring it safely down.',
    lineNl: 'Teken voor elk binnenkomend toestel een route en breng het veilig aan de grond.',
    practises: 'Dividing attention, planning ahead, holding back',
    practisesNl: 'Aandacht verdelen, vooruit plannen, impuls remmen',
    age: '6+',
    paint: drawPlaneThumb,
  },
  {
    href: './nightwatch.html',
    title: 'Night Watch',
    line: 'The sky shows a figure in the stars. The lines fade. Draw it back.',
    lineNl: 'De hemel toont een figuur in de sterren. De lijnen vervagen. Teken hem terug.',
    practises: 'Visual working memory',
    practisesNl: 'Visueel werkgeheugen',
    age: '5+',
    paint: drawStarsThumb,
  },
  {
    href: './orbit.html',
    title: 'Orbit',
    line: 'Put the eight planets in order, in real photographs from NASA.',
    lineNl: 'Zet de acht planeten op volgorde, in echte opnamen van NASA.',
    practises: 'Ordering, comparing sizes, knowing the solar system',
    practisesNl: 'Ordenen, groottes vergelijken, het zonnestelsel kennen',
    age: '5+',
    img: './img/planets/saturn.jpg',
  },
  {
    href: './dig.html',
    title: 'Dino Dig',
    line: 'Brush the dirt from a real fossil and work out whose bones these are.',
    lineNl: 'Borstel het zand van een echt fossiel en bedenk van wie deze botten zijn.',
    practises: 'Patience, recognising a whole from its parts',
    practisesNl: 'Geduld, het geheel herkennen aan de delen',
    age: '5+',
    img: './img/fossils/velo.png',
    tint: '#d9c49a',
  },
];

function card(g: Game): HTMLElement {
  const a = document.createElement('a');
  a.className = 'gamecard';
  a.href = g.href;
  a.innerHTML = `
    <div class="gamethumb"></div>
    <div class="gamebody">
      <div class="gamehead"><h3>${g.title}</h3><span class="agepill">${g.age}</span></div>
      <p>${NL() ? g.lineNl : g.line}</p>
      <div class="practises">${NL() ? g.practisesNl : g.practises}</div>
    </div>`;
  const thumb = a.querySelector('.gamethumb') as HTMLElement;
  if (g.img) {
    const im = document.createElement('img');
    im.src = g.img; im.alt = '';
    im.loading = 'lazy';
    thumb.appendChild(im);
    if (g.tint) thumb.style.background = g.tint;
  } else if (g.paint) {
    const c = document.createElement('canvas');
    thumb.appendChild(c);
    // the canvas needs its laid out size before it can be painted at the right resolution
    requestAnimationFrame(() => g.paint!(c));
    window.addEventListener('resize', () => g.paint!(c));
  }
  return a;
}

function promise(): HTMLElement {
  const d = document.createElement('div');
  d.className = 'card promise';
  d.innerHTML = `
    <div class="sub">${T('What we promise parents', 'Wat we ouders beloven')}</div>
    <ul class="skills">
      <li><b>${T('No advertising', 'Geen advertenties')}</b><span>${T(
        'Nothing interrupts a game, and nothing is sold to your child.',
        'Niets onderbreekt een spel, en er wordt niets aan je kind verkocht.')}</span></li>
      <li><b>${T('No tracking, no account', 'Geen volgsoftware, geen account')}</b><span>${T(
        'Progress stays on the device. Nothing about your child leaves it.',
        'De voortgang blijft op het toestel. Er gaat niets over je kind weg.')}</span></li>
      <li><b>${T('Sessions end', 'Sessies eindigen')}</b><span>${T(
        'Every game has a last round. No endless loop, no daily reward pulling anyone back.',
        'Elk spel heeft een laatste ronde. Geen oneindige lus, geen dagelijkse beloning die terugtrekt.')}</span></li>
      <li><b>${T('We say what we do not know', 'We zeggen wat we niet weten')}</b><span>${T(
        'Each game states what it practises, and where the evidence stops.',
        'Elk spel vertelt wat het oefent, en waar het bewijs ophoudt.')}</span></li>
    </ul>`;
  return d;
}

const root = document.getElementById('hub')!;
const head = document.createElement('div');
head.className = 'logo';
head.innerHTML = `<div class="word">Bramblewood</div><div class="tag">${T(
  'Games that practise something real', 'Spellen die iets echts oefenen')}</div>`;
root.appendChild(head);

const grid = document.createElement('div');
grid.className = 'gamegrid';
for (const g of GAMES) grid.appendChild(card(g));
root.appendChild(grid);
root.appendChild(promise());
