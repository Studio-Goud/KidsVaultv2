/**
 * Bramblewood, the front door.
 *
 * One page that holds every game in the world, says in a line what each one practises, and carries
 * the promise the whole thing rests on: no advertising, no tracking, and a session that ends.
 */

import '../style.css';
import { drawAnimalsThumb, drawClockThumb, drawDigThumb, drawMarketThumb, drawMoonThumb, drawPuffThumb, drawPlaneThumb, drawStarsThumb, drawTideThumb, drawValleyThumb } from './thumbs';

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
    line: 'Order the planets, explore them in NASA photographs, and launch probes to reach them.',
    lineNl: 'Zet de planeten op volgorde, verken ze in NASA-opnamen en lanceer sondes om ze te bereiken.',
    practises: 'Ordering, comparing sizes, predicting motion, knowing the solar system',
    practisesNl: 'Ordenen, groottes vergelijken, beweging voorspellen, het zonnestelsel kennen',
    age: '5+',
    img: './img/planets/saturn.jpg',
  },
  {
    href: './moonshot.html',
    title: 'Moonshot',
    line: 'A workshop with two dozen parts and nothing locked. Build any rocket you like, then fly it as far as it will go.',
    lineNl: 'Een werkplaats met vierentwintig onderdelen en niets op slot. Bouw de raket die jij wilt en vlieg er zo ver mee als hij komt.',
    practises: 'Weighing one thing against another, cause and effect, shape against speed',
    practisesNl: 'Afwegen, oorzaak en gevolg, vorm tegen snelheid',
    age: '6+',
    paint: drawMoonThumb,
  },
  {
    href: './mill.html',
    title: 'Millstream',
    line: 'Dig channels, and the water finds its own way to the fields and the mill. Build a village with what the valleys pay.',
    lineNl: 'Graaf geulen, en het water vindt zelf zijn weg naar de akkers en de molen. Bouw een dorp van wat de valleien opleveren.',
    practises: 'Spatial reasoning, planning ahead, cause and effect, saving up',
    practisesNl: 'Ruimtelijk inzicht, vooruitdenken, oorzaak en gevolg, sparen',
    age: '5+',
    paint: drawValleyThumb,
  },
  {
    href: './tidepool.html',
    title: 'Tidepool',
    line: 'Sort what the tide brings into the right pools. Then the rule changes.',
    lineNl: 'Sorteer wat het tij brengt in de juiste poelen. Dan verandert de regel.',
    practises: 'Cognitive flexibility, switching rules',
    practisesNl: 'Denkflexibiliteit, van regel wisselen',
    age: '4+',
    paint: drawTideThumb,
  },
  {
    href: './market.html',
    title: 'Market Day',
    line: 'Fill the basket with exactly what they asked for, share it fairly, and ring the bell.',
    lineNl: 'Vul de mand met precies wat ze vroegen, deel eerlijk, en bel.',
    practises: 'Counting out, sharing equally, how many more',
    practisesNl: 'Uittellen, eerlijk delen, hoeveel erbij',
    age: '4+',
    paint: drawMarketThumb,
  },
  {
    href: './puffball.html',
    title: 'Puffball',
    line: 'Put down a puffball, count how far it reaches, and be somewhere else when it pops.',
    lineNl: 'Zet een stuifzwam neer, tel hoe ver hij komt, en sta ergens anders als hij plooft.',
    practises: 'Counting squares, comparing two numbers, planning a way out',
    practisesNl: 'Vakjes tellen, twee getallen vergelijken, een uitweg plannen',
    age: '5+',
    paint: drawPuffThumb,
  },
  {
    href: './dig.html',
    title: 'Dino Dig',
    line: 'Brush the dirt from a real fossil and work out whose bones these are.',
    lineNl: 'Borstel het zand van een echt fossiel en bedenk van wie deze botten zijn.',
    practises: 'Patience, recognising a whole from its parts',
    practisesNl: 'Geduld, het geheel herkennen aan de delen',
    age: '5+',
    // the card shows the dig, not the specimen: the photographs are the reward inside the game,
    // and a white photographic plate among the other cards looked like a stock image
    paint: drawDigThumb,
  },
  {
    href: './clock.html',
    title: 'Klokkijken',
    line: 'Read the hands, pick the figures, and drag the hands to the time you are given.',
    lineNl: 'Lees de wijzers, kies de cijfers, en sleep de wijzers naar de tijd die gevraagd wordt.',
    practises: 'Reading the analogue and digital clock, saying the time in Dutch, counting on in minutes',
    practisesNl: 'De analoge en digitale klok lezen, de tijd in het Nederlands zeggen, minuten doortellen',
    age: '6+',
    paint: drawClockThumb,
  },
  {
    href: './animals.html',
    title: 'Dierenboek',
    line: 'Thousands of real animals in real photographs. How big it is next to you, where it lives, what it eats.',
    lineNl: 'Duizenden echte dieren op echte foto\'s. Hoe groot het is naast jou, waar het leeft, wat het eet.',
    practises: 'Looking closely, comparing sizes, sorting into groups, finding your way around a long list',
    practisesNl: 'Goed kijken, groottes vergelijken, in groepen indelen, iets opzoeken',
    age: '4+',
    paint: drawAnimalsThumb,
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
