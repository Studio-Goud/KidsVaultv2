import '../style.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import { CATALOG, domainsPresent, shelf, type Domain } from '../platform/catalog';
import {
  cleanChild, cleanUsed, dayKey, finished, FRESH_USED, leftToday, limitIsGuidance, limitsFor,
  limitsForAge, useToday, type Child, type Used,
} from '../platform/session';
import { cleanGate, needsSetup, setPin, tryPin, waitingFor, type GateState } from '../platform/gate';
import { QUESTIONS, domainsWithCounts } from './faq';
import { NL, T } from '../util/lang';
import { persist, save } from '../util/storage';

/**
 * The parent's half of the app.
 *
 * Everything here is for somebody who can read, standing in a kitchen, probably once a month.
 * So it is a plain page rather than a canvas: big rows, real form controls, no animation, and
 * nothing that has to be learnt. The child's half is the one that gets the craft.
 *
 * It is also the half that earns the subscription. A parent does not pay for sixteen games; they
 * pay to be able to hand over a phone without thinking about it. So the three things on this
 * page are the three things that buys: how long, what is on offer, and what happened.
 */

const root = document.getElementById('parents')!;

// ---------------------------------------------------------------- the save, as this page sees it

const gate = (): GateState => cleanGate(save.family.gate);
const children = (): Child[] =>
  (save.family.children ?? []).map(cleanChild).filter((c): c is Child => c !== null);
const usedBy = (id: string): Used => cleanUsed(save.family.used?.[id]);

function writeGate(g: GateState): void { save.family.gate = g; persist(); }
function writeChildren(list: Child[]): void {
  save.family.children = list.map(c => ({ ...c, domains: c.domains.slice() }));
  persist();
}

const nowSecs = (): number => Math.floor(Date.now() / 1000);
const today = (): string => dayKey(new Date());

// ---------------------------------------------------------------- small builders

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls = '', html = '',
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

function panel(title: string, ...kids: HTMLElement[]): HTMLElement {
  const p = el('div', 'panel');
  if (title) p.appendChild(el('h2', '', title));
  for (const k of kids) p.appendChild(k);
  return p;
}

function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', `btn ${cls}`);
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function show(...kids: HTMLElement[]): void {
  root.textContent = '';
  const sheet = el('div', 'sheet');
  for (const k of kids) sheet.appendChild(k);
  root.appendChild(sheet);
}

// ---------------------------------------------------------------- the door

/**
 * The code, as four boxes.
 *
 * Four separate inputs rather than one, because on a phone that gives four big targets and a
 * numeric keyboard, and because a parent can see at a glance how far they have got.
 */
function pinBoxes(onFull: (pin: string) => void): HTMLElement {
  const wrap = el('div', 'pin');
  const boxes: HTMLInputElement[] = [];
  for (let i = 0; i < 4; i++) {
    const b = el('input');
    b.type = 'tel';
    b.inputMode = 'numeric';
    b.maxLength = 1;
    b.autocomplete = 'off';
    b.addEventListener('input', () => {
      b.value = b.value.replace(/\D/g, '').slice(0, 1);
      if (b.value && i < 3) boxes[i + 1].focus();
      const all = boxes.map(x => x.value).join('');
      if (all.length === 4) onFull(all);
    });
    b.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus();
    });
    boxes.push(b);
    wrap.appendChild(b);
  }
  requestAnimationFrame(() => boxes[0].focus());
  (wrap as HTMLElement & { clear?: () => void }).clear = () => {
    for (const b of boxes) b.value = '';
    boxes[0].focus();
  };
  return wrap;
}

function askForCode(): void {
  const g = gate();
  const wait = waitingFor(g, nowSecs());
  const bad = el('p', 'bad');

  if (wait > 0) {
    show(panel(T('Just a moment', 'Even wachten'),
      el('p', 'note', T(
        `Five wrong codes. Try again in ${wait} seconds.`,
        `Vijf keer een verkeerde code. Probeer het over ${wait} seconden nog eens.`)),
    ), homeLink());
    setTimeout(askForCode, 1000);
    return;
  }

  const boxes = pinBoxes(pin => {
    const a = tryPin(gate(), pin, nowSecs());
    writeGate(a.state);
    if (a.ok) { overview(); return; }
    (boxes as HTMLElement & { clear?: () => void }).clear?.();
    bad.textContent = a.why === 'waiting'
      ? T('Too many tries. Wait a minute.', 'Te vaak geprobeerd. Wacht even een minuutje.')
      : T('That is not the code.', 'Dat is de code niet.');
  });

  show(
    panel(T('For grown-ups', 'Voor ouders'),
      el('p', 'note', T('Type the four-digit code you chose.', 'Typ de code van vier cijfers die je hebt gekozen.')),
      boxes, bad),
    faqLink(askForCode),
    homeLink(),
  );
}

function chooseCode(): void {
  const bad = el('p', 'bad');
  let first = '';
  let boxes: HTMLElement;

  const ask = (): void => {
    boxes = pinBoxes(pin => {
      if (!first) {
        const r = setPin(gate(), pin);
        if (!r.ok) {
          bad.textContent = r.why === 'tooEasy'
            ? T('Pick something less obvious than that.', 'Kies iets minder voor de hand liggends dan dat.')
            : T('Four digits, please.', 'Vier cijfers graag.');
          (boxes as HTMLElement & { clear?: () => void }).clear?.();
          return;
        }
        first = pin;
        bad.textContent = '';
        draw(T('Once more, to be sure.', 'Nog een keer, voor de zekerheid.'));
        return;
      }
      if (pin !== first) {
        first = '';
        bad.textContent = T('Those were not the same. Start again.', 'Die waren niet hetzelfde. Begin opnieuw.');
        draw(T('Choose a code of four digits.', 'Kies een code van vier cijfers.'));
        return;
      }
      const r = setPin(gate(), pin);
      if (r.ok) { writeGate(r.state); overview(); }
    });
    return;
  };

  const draw = (line: string): void => {
    ask();
    show(
      panel(T('Choose a code', 'Kies een code'),
        el('p', 'note', line),
        el('p', 'note quiet', T(
          'This keeps your child out of the settings. Nothing here is sent anywhere; the code stays on this device.',
          'Hiermee houd je je kind uit de instellingen. Er gaat niets weg van dit toestel; de code blijft hier.')),
        boxes, bad),
      faqLink(() => draw(line)),
      homeLink(),
    );
  };

  draw(T('Choose a code of four digits.', 'Kies een code van vier cijfers.'));
}

// ---------------------------------------------------------------- who is playing

function overview(): void {
  const list = children();
  const kids = el('div', 'stack');

  for (const c of list) {
    const u = useToday(usedBy(c.id), today());
    const lim = limitsFor(c);
    const left = leftToday(u, c, today());
    const b = el('button', `kid${save.family.playing === c.id ? ' on' : ''}`);
    b.type = 'button';
    b.innerHTML = `<div class="who"><b>${c.name || T('Without a name', 'Zonder naam')}</b>
      <span>${c.years} ${T('years', 'jaar')} &middot; ${T('today', 'vandaag')} ${u.minutes} ${T('of', 'van')} ${lim.perDay} ${T('min', 'min')}</span></div>`;
    b.addEventListener('click', () => childScreen(c.id));
    kids.appendChild(b);
    const bar = el('div', 'bar');
    bar.appendChild(el('i')).setAttribute('style', `width:${Math.round(100 - (left / lim.perDay) * 100)}%`);
    kids.appendChild(bar);
  }

  if (!list.length) {
    kids.appendChild(el('p', 'note', T(
      'Nobody yet. Add your child and the app knows how long they may play and what to offer.',
      'Nog niemand. Voeg je kind toe, dan weet de app hoe lang het mag spelen en wat het te zien krijgt.')));
  }

  show(
    el('h1', '', T('For grown-ups', 'Voor ouders')),
    panel(T('Who plays here', 'Wie spelen hier'), kids,
      button(T('Add a child', 'Kind toevoegen'), 'mint', () => addChild())),
    promisePanel(),
    subscriptionPanel(),
    panel(T('The code', 'De code'),
      el('p', 'note quiet', T(
        'A code stops the everyday thing: a child wandering in here and turning off their own time limit. It is not a safe. A determined ten-year-old on a desktop computer can get past it.',
        'Een code houdt het alledaagse tegen: een kind dat hier binnenloopt en zijn eigen tijdslimiet uitzet. Het is geen kluis. Een vastberaden tienjarige op een computer komt erlangs.')),
      button(T('Change the code', 'Code wijzigen'), 'secondary', () => { writeGate({ code: '', wrong: 0, until: 0 }); chooseCode(); })),
    faqLink(overview),
    homeLink(),
  );
}

function addChild(): void {
  const list = children();
  const id = `k${Date.now().toString(36)}`;
  list.push({ id, name: '', years: 5, domains: [], limits: null, warn: false });
  writeChildren(list);
  if (!save.family.playing) { save.family.playing = id; persist(); }
  childScreen(id);
}

// ---------------------------------------------------------------- one child

function childScreen(id: string): void {
  const list = children();
  const c = list.find(x => x.id === id);
  if (!c) { overview(); return; }
  const write = (): void => writeChildren(list);

  // ---- name and age
  const name = el('input');
  name.type = 'text';
  name.value = c.name;
  name.placeholder = T('Name', 'Naam');
  name.addEventListener('input', () => { c.name = name.value.slice(0, 24); write(); });

  const years = el('select');
  for (let y = 2; y <= 10; y++) {
    const o = el('option');
    o.value = String(y);
    o.textContent = `${y} ${T('years', 'jaar')}`;
    if (y === c.years) o.selected = true;
    years.appendChild(o);
  }
  years.addEventListener('change', () => {
    c.years = Number(years.value);
    c.limits = null;                                  // a new age means the guidance again
    write();
    childScreen(id);
  });

  const whoLine = el('div', 'line');
  whoLine.append(name, years);

  // ---- how long
  const lim = limitsFor(c);
  const dayOut = el('b', '', `${lim.perDay} ${T('min', 'min')}`);
  const day = el('input');
  day.type = 'range';
  day.min = '10'; day.max = '120'; day.step = '5';
  day.value = String(lim.perDay);
  day.addEventListener('input', () => {
    const perDay = Number(day.value);
    c.limits = { perDay, perSitting: Math.min(limitsFor(c).perSitting, perDay) };
    dayOut.textContent = `${perDay} ${T('min', 'min')}`;
    write();
  });
  const dayLine = el('div', 'line');
  dayLine.append(el('label', '', T('Per day', 'Per dag')), day, dayOut);

  const advice = limitIsGuidance(c.years)
    ? T(
      `The Nederlands Jeugdinstituut advises ${limitsForAge(c.years).perDay} minutes a day at this age.`,
      `Het Nederlands Jeugdinstituut adviseert op deze leeftijd ${limitsForAge(c.years).perDay} minuten per dag.`)
    : T(
      'Above six there is no Dutch guideline we can point at, so this number is ours and you should treat it as a starting point, not as advice.',
      'Boven de zes is er geen Nederlandse richtlijn om naar te wijzen, dus dit getal is van ons. Zie het als een beginpunt, niet als advies.');

  // ---- the ending
  const warn = el('input');
  warn.type = 'checkbox';
  warn.checked = c.warn;
  warn.addEventListener('change', () => { c.warn = warn.checked; write(); });
  const warnLine = el('div', 'line');
  const warnLabel = el('label');
  warnLabel.textContent = T('Warn before the end', 'Waarschuwen voor het einde');
  warnLine.append(warnLabel, warn);

  // ---- what is on offer
  const chips = el('div', 'chips');
  for (const d of domainsPresent()) {
    const chip = el('button', `chip${c.domains.includes(d) ? ' on' : ''}`);
    chip.type = 'button';
    chip.textContent = domainName(d);
    chip.addEventListener('click', () => {
      c.domains = c.domains.includes(d) ? c.domains.filter(x => x !== d) : [...c.domains, d];
      write();
      childScreen(id);
    });
    chips.appendChild(chip);
  }

  // the same rows the child's shelf is built from, so this count cannot drift away from it
  const fits = shelf(c).now;

  // ---- what happened
  const u = useToday(usedBy(c.id), today());

  show(
    el('h1', '', c.name || T('This child', 'Dit kind')),
    panel(T('Who', 'Wie'), whoLine),
    panel(T('How long', 'Hoe lang'), dayLine,
      el('p', 'note quiet', advice),
      warnLine,
      el('p', 'note quiet', T(
        'Off is the researched setting. A warning before the end was found to make the handover harder, not easier; a last game that finishes properly works better.',
        'Uit is de onderzochte stand. Een waarschuwing vooraf bleek het overgeven juist moeilijker te maken; een laatste spelletje dat netjes afloopt werkt beter.'))),
    panel(T('What is on offer', 'Wat er te doen is'),
      el('p', 'note', T(
        'Nothing chosen means everything. Choose one or more and the rest is put away.',
        'Niets gekozen betekent alles. Kies er een of meer, dan wordt de rest opgeborgen.')),
      chips,
      el('p', 'note quiet', `${fits.length} ${T('of', 'van de')} ${CATALOG.length} ${T('things fit this child right now.', 'dingen passen nu bij dit kind.')} ${T(
        'The age puts nothing away: what is still too old, or already outgrown, stays on the shelf in a row of its own.',
        'De leeftijd bergt niets op: wat nog te oud is, of al ontgroeid, blijft op de plank staan in een eigen rij.')}`)),
    panel(T('Today', 'Vandaag'),
      el('p', 'note', `${u.minutes} ${T('minutes', 'minuten')} &middot; ${u.finished} ${T('things finished', 'dingen afgemaakt')}`),
      el('p', 'note quiet', T(
        'We do not compare your child with anybody else, and there is no league table. This is what happened, nothing more.',
        'We vergelijken je kind met niemand, en er is geen ranglijst. Dit is wat er gebeurd is, meer niet.'))),
    panel('',
      button(T('This one is playing', 'Deze speelt nu'), 'mint', () => {
        save.family.playing = id; persist(); overview();
      }),
      button(T('Remove this child', 'Dit kind verwijderen'), 'quiet', () => {
        writeChildren(list.filter(x => x.id !== id));
        if (save.family.playing === id) { save.family.playing = ''; persist(); }
        overview();
      })),
    button(T('Back', 'Terug'), 'secondary', () => overview()),
  );
}

function domainName(d: Domain): string {
  const names: Record<Domain, [string, string]> = {
    taal: ['Language', 'Taal'], rekenen: ['Numbers', 'Rekenen'], tijd: ['Time', 'Tijd'],
    vormen: ['Shapes', 'Vormen'], dieren: ['Animals', 'Dieren'], dinos: ['Dinosaurs', 'Dinosaurussen'],
    ruimte: ['Space', 'Ruimte'], techniek: ['Machines', 'Techniek'], natuur: ['Nature', 'Natuur'],
    muziek: ['Music', 'Muziek'], aardrijkskunde: ['Geography', 'Aardrijkskunde'], spel: ['Just for fun', 'Gewoon leuk'],
  };
  const n = names[d];
  return NL() ? n[1] : n[0];
}

// ---------------------------------------------------------------- the standing promises

function promisePanel(): HTMLElement {
  const lines: Array<[string, string]> = NL()
    ? [
      ['Geen advertenties', 'Niets onderbreekt een spel, en er wordt niets aan je kind verkocht.'],
      ['Geen volgsoftware', 'De voortgang blijft op dit toestel. Er gaat niets over je kind weg.'],
      ['Sessies eindigen', 'Elk spel heeft een laatste ronde, en met een tijdslimiet ook elke dag.'],
      ['We zeggen wat we niet weten', 'Waar een advies van ons komt in plaats van van onderzoek, staat dat erbij.'],
    ]
    : [
      ['No advertising', 'Nothing interrupts a game, and nothing is sold to your child.'],
      ['No tracking', 'Progress stays on this device. Nothing about your child leaves it.'],
      ['Sessions end', 'Every game has a last round, and with a limit set, so does every day.'],
      ['We say what we do not know', 'Where a number is ours rather than research, it says so.'],
    ];
  const ul = el('ul', 'skills');
  for (const [b, s] of lines) ul.appendChild(el('li', '', `<b>${b}</b><span>${s}</span>`));
  return panel(T('What we promise', 'Wat we beloven'), ul);
}

function subscriptionPanel(): HTMLElement {
  return panel(T('Subscription', 'Abonnement'),
    el('p', 'note', T(
      'Suri costs €3.99 a month. That pays for the making of it, and it is why there is nothing to sell your child inside it.',
      'Suri kost €3,99 per maand. Daarvan wordt het gemaakt, en daarom valt er binnen de app niets aan je kind te verkopen.')),
    el('p', 'note quiet', T(
      'Billing is not built yet. When it is, it runs through the App Store or Google Play, so cancelling is where you cancel everything else.',
      'Het afrekenen is nog niet gebouwd. Straks loopt het via de App Store of Google Play, zodat opzeggen gaat waar je alles opzegt.')));
}

/**
 * The questions page.
 *
 * It sits in front of the code rather than behind it, because it is the page a parent who has not
 * decided about this app yet needs to read, and asking them for a code they have not chosen would
 * be a strange way to answer "what is this for".
 */
function faqScreen(back: () => void): void {
  const kids: HTMLElement[] = [
    panel(T('Questions', 'Vragen'),
      el('p', 'note', T(
        'Everything below is as it really is. Where something is not built yet or not known, it says so.',
        'Alles hieronder staat er zoals het werkelijk is. Waar iets nog niet gebouwd of niet bekend is, staat dat erbij.'))),
  ];

  for (const q of QUESTIONS) {
    const d = el('details', 'q');
    const sum = el('summary');
    sum.textContent = NL() ? q.qNl : q.q;
    d.appendChild(sum);
    const body = el('div', 'body');
    for (const para of (NL() ? q.aNl : q.a)) body.appendChild(el('p', 'note', '')).textContent = para;
    d.appendChild(body);
    kids.push(d);
  }

  // the subjects, built from the catalogue rather than typed out again, so this cannot drift
  const subjects = el('details', 'q');
  const sum = el('summary');
  sum.textContent = T('Which subjects are in here, and what each one is for',
    'Welke onderwerpen erin zitten, en waar elk voor is');
  subjects.appendChild(sum);
  const ul = el('ul', 'skills');
  for (const row of domainsWithCounts()) {
    const li = el('li');
    const b = el('b'); b.textContent = `${row.name} · ${row.n}`;
    const sp = el('span'); sp.textContent = row.note;
    li.appendChild(b); li.appendChild(sp);
    ul.appendChild(li);
  }
  const body = el('div', 'body');
  body.appendChild(ul);
  subjects.appendChild(body);
  kids.push(subjects);

  kids.push(button(T('Back', 'Terug'), 'quiet', back));
  show(...kids, homeLink());
}

/** The link to the questions, which every door on this screen carries. */
function faqLink(back: () => void): HTMLElement {
  return button(T('Why does this app exist?', 'Waarom bestaat deze app?'), 'quiet',
    () => faqScreen(back));
}

function homeLink(): HTMLElement {
  const a = el('a', 'btn quiet');
  a.href = './';
  a.textContent = T('Back to Suri', 'Terug naar Suri');
  return a;
}

// ---------------------------------------------------------------- go

if (needsSetup(gate())) chooseCode(); else askForCode();
