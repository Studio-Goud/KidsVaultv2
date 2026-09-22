/**
 * Braambos, the front door.
 *
 * One page that holds every game in the world, says in a line what each one practises, and carries
 * the promise the whole thing rests on: no advertising, no tracking, and a session that ends.
 */

import '../style.css';
import { drawAnimalsThumb, drawAtlasThumb, drawCircuitThumb, drawClockThumb, drawLettersThumb, drawDigThumb, drawMarketThumb, drawMoonThumb, drawNumbersThumb, drawPuffThumb, drawPlaneThumb, drawRhythmThumb, drawStarsThumb, drawTideThumb, drawValleyThumb } from './thumbs';
import { NL, T } from '../util/lang';
import { CATALOG, type Entry } from '../platform/catalog';
import { lastGoNow, startClock } from '../platform/clock';
import { drawGuide } from '../platform/guide';
import { loadVoice } from '../platform/voice';



/**
 * What each entry looks like on the shelf. The words live in the catalogue; this is only the
 * picture, because a thumbnail is presentation and belongs with the page that shows it.
 */
const ART: Record<string, { img?: string; tint?: string; paint?: (c: HTMLCanvasElement) => void }> = {
  cloudhopper: { paint: drawPlaneThumb },
  nightwatch: { paint: drawStarsThumb },
  orbit: { img: './img/planets/saturn.jpg' },
  moonshot: { paint: drawMoonThumb },
  circuit: { paint: drawCircuitThumb },
  mill: { paint: drawValleyThumb },
  tidepool: { paint: drawTideThumb },
  market: { paint: drawMarketThumb },
  puffball: { paint: drawPuffThumb },
  dig: { paint: drawDigThumb },
  clock: { paint: drawClockThumb },
  atlas: { paint: drawAtlasThumb },
  animals: { paint: drawAnimalsThumb },
  letters: { paint: drawLettersThumb },
  rhythm: { paint: drawRhythmThumb },
  numbers: { paint: drawNumbersThumb },
};

function card(g: Entry): HTMLElement {
  const art = ART[g.id] ?? {};
  const a = document.createElement('a');
  a.className = 'gamecard';
  a.href = `./${g.id}.html`;
  // the age is a span now rather than a floor: the app runs from two to ten and a thing a child
  // has outgrown should say so
  a.innerHTML = `
    <div class="gamethumb"></div>
    <div class="gamebody">
      <div class="gamehead"><h3>${g.title}</h3><span class="agepill">${g.from}-${g.to}</span></div>
      <p>${NL() ? g.lineNl : g.line}</p>
      <div class="practises">${NL() ? g.practisesNl : g.practises}</div>
    </div>`;
  const thumb = a.querySelector('.gamethumb') as HTMLElement;
  if (art.img) {
    const im = document.createElement('img');
    im.src = art.img; im.alt = '';
    im.loading = 'lazy';
    thumb.appendChild(im);
    if (art.tint) thumb.style.background = art.tint;
  } else if (art.paint) {
    const c = document.createElement('canvas');
    thumb.appendChild(c);
    // the canvas needs its laid out size before it can be painted at the right resolution
    requestAnimationFrame(() => art.paint!(c));
    window.addEventListener('resize', () => art.paint!(c));
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
head.innerHTML = `<div class="word">Braambos</div><div class="tag">${T(
  'Games that practise something real', 'Spellen die iets echts oefenen')}</div>`;
root.appendChild(head);

const grid = document.createElement('div');
grid.className = 'gamegrid';
for (const g of CATALOG) grid.appendChild(card(g));
root.appendChild(grid);
root.appendChild(promise());

/**
 * "This is your last one today."
 *
 * Announced here, on the shelf, where a child is choosing - not in the middle of a game, and not
 * as a clock counting down. It is the whole of the researched ending: a last go that is known to
 * be the last, played to its own end.
 */
if (lastGoNow()) {
  const say = document.createElement('div');
  say.className = 'card lastgo';
  say.innerHTML = `<canvas width="120" height="120"></canvas><p>${T(
    'This is your last one today. Pick a good one!',
    'Dit wordt je laatste spelletje van vandaag. Kies maar een leuke!')}</p>`;
  root.insertBefore(say, root.firstChild?.nextSibling ?? null);
  const c = say.querySelector('canvas') as HTMLCanvasElement;
  const ctx = c.getContext('2d');
  if (ctx) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = 120 * dpr; c.height = 120 * dpr;
    let t = 0;
    const paint = (): void => {
      t += 0.016;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, 120, 120);
      drawGuide(ctx, 60, 112, 104, { pose: 'watch', t });
      requestAnimationFrame(paint);
    };
    paint();
  }
}

loadVoice();
startClock();
