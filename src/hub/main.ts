/**
 * Suri, the front door.
 *
 * One page that holds every game in the world, says in a line what each one practises, and carries
 * the promise the whole thing rests on: no advertising, no tracking, and a session that ends.
 */

import '../style.css';
import { drawSeasonsThumb, drawAnimalsThumb, drawAtlasThumb, drawCircuitThumb, drawClockThumb, drawLettersThumb, drawDigThumb, drawMarketThumb, drawMoonThumb, drawNumbersThumb, drawPuffThumb, drawPlaneThumb, drawRhythmThumb, drawStarsThumb, drawTideThumb, drawTripThumb, drawDiveThumb, drawValleyThumb } from './thumbs';
import { NL, T } from '../util/lang';
import { shelf, type Entry } from '../platform/catalog';
import { lastGoNow, startClock } from '../platform/clock';
import { drawGuide } from '../platform/guide';
import { loadVoice } from '../platform/voice';
import { playingChild, yearsNow } from '../platform/who';
import { soundThenGo } from './homebtn';



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
  reis: { paint: drawTripThumb },
  seasons: { paint: drawSeasonsThumb },
  diepzee: { paint: drawDiveThumb },
};

function card(g: Entry): HTMLElement {
  const art = ART[g.id] ?? {};
  const a = document.createElement('a');
  a.className = 'gamecard';
  a.href = `./${g.id}.html`;
  a.addEventListener('click', e => soundThenGo(e, a.href, 'open'));
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

/**
 * The card that is addressed to a parent, and the way in to their own screen.
 *
 * The link lives here and not in a corner of the shelf, because this is the paragraph a grown-up
 * who has picked up the phone is already reading. Before it existed the only way into the parent
 * screen was the closing overlay at the end of a day - which needs a child profile, which can only
 * be made in the parent screen. There was no door.
 *
 * It is not hidden from the child either. It does not need to be: what is behind it is behind a
 * code, and a shelf of games is more interesting than a settings page to everyone under ten.
 */
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
    </ul>
    <a class="parentlink" href="./parents.html">${T(
      'For grown-ups: time limits, subjects, and the questions parents ask',
      'Voor ouders: tijdslimiet, onderwerpen, en de vragen die ouders stellen')}</a>`;
  return d;
}

const root = document.getElementById('hub')!;

/**
 * The top of the shelf: who this is, and the way out to the grown-ups.
 *
 * It used to be the app's name in white type on the pale sky, which needed a dark wash painted
 * behind it to be readable at all - and that wash read as a smudge. Dark type on a pale sky needs
 * nothing behind it, so the wash is gone and the name is ink.
 *
 * The way into the parent screen lives here rather than at the foot of the page. A parent opening
 * this app for the first time is looking for their own settings, and asking them to scroll past
 * eighteen game cards to find them was the wrong way round.
 */
const head = document.createElement('header');
head.className = 'hubtop';
head.innerHTML = `
  <img class="mark" src="./icons/icon-192.png" alt="" width="56" height="56" />
  <div class="name">
    <div class="word">Suri</div>
    <div class="tag">${T('Games that practise something real', 'Spellen die iets echts oefenen')}</div>
  </div>
  <a class="grownups" href="./parents.html">${T('For grown-ups', 'Voor ouders')}</a>`;
root.appendChild(head);
const grown = head.querySelector('.grownups') as HTMLAnchorElement;
grown.addEventListener('click', e => soundThenGo(e, grown.href, 'tap'));

/**
 * The shelf, for the child who is playing.
 *
 * What the parent chose on their own screen is applied here, and nowhere else: subjects switched
 * off are not on the shelf, and the age splits it into what fits now, what is still to grow into,
 * and what the child has outgrown. `shelf()` says why nothing disappears on a birthday.
 *
 * `yearsNow()` rather than the child's own age, so the audit's `__years` hook shows each shelf.
 */
function grid(list: Entry[]): HTMLElement {
  const g = document.createElement('div');
  g.className = 'gamegrid';
  for (const e of list) g.appendChild(card(e));
  return g;
}

function shelfHead(en: string, nl: string): HTMLElement {
  const h = document.createElement('h2');
  h.className = 'shelfhead';
  h.textContent = T(en, nl);
  return h;
}

const kid = playingChild();
const years = yearsNow();
const rows = shelf(years === null ? null : { years, domains: kid?.domains ?? [] });
root.appendChild(grid(rows.now));
if (rows.later.length) {
  root.appendChild(shelfHead('Still to grow into', 'Hier groei je nog naartoe'));
  root.appendChild(grid(rows.later));
}
if (rows.earlier.length) {
  root.appendChild(shelfHead('From when you were smaller', 'Van toen je kleiner was'));
  root.appendChild(grid(rows.earlier));
}
const card0 = promise();
const plink = card0.querySelector('.parentlink') as HTMLAnchorElement;
plink.addEventListener('click', e => soundThenGo(e, plink.href, 'tap'));
root.appendChild(card0);

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
