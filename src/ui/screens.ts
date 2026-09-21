import { PLANE_TYPES, displayKmh } from '../game/planes';
import { drawPlane } from '../render/planes';
import type { Report } from '../game/postmortem';
import { LEVELS_PER_WORLD, MAX_STARS, WORLDS, buildMission, firstAppearance, grandTotalStars, missionId, missionUnlocked, portMissionUnlocked, portStars, portUnlocked, route, routeNow, stopOpen, stopShort, worldStars, worldUnlocked } from '../game/progress';
import { UPGRADES, buyUpgrade, nextCost, upgradeDesc, upgradeName } from '../game/upgrades';
import { PORTS_IN_ORDER } from '../game/realports';
import { lang, t } from '../i18n';
import { levelProgress, persist, realId, save, upgradeLevel } from '../util/storage';

/** The islands have a Dutch name and an English one; every other game's level names work this way. */
const worldName = (w: { name: string; nameEn: string }): string => (lang() === 'nl' ? w.name : w.nameEn);
import { sfx } from '../util/audio';

export interface UIActions {
  startMission(worldIndex: number, index: number): void;
  resume(): void;
  retry(): void;
  next(): void;
  toWorlds(): void;
  toMissions(worldIndex: number): void;
  toTitle(): void;
  continueEndless(): void;
  openSettings(): void;
  closeSettings(): void;
  openFleet(): void;
  closeFleet(): void;
  openPorts(): void;
  startReal(portId: string, step: number): void;
  makePortThumb(portId: string, canvas: HTMLCanvasElement): void;
  tutorialDone(): void;
  makeThumb(worldIndex: number, canvas: HTMLCanvasElement): void;
  revive(): void;
  openParents(): void;
  closeParents(): void;
}

const svgStar = (on: boolean, size = 16): string =>
  `<svg class="star" viewBox="0 0 24 24" width="${size}" height="${size}"><path d="M12 2.6l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.5l-5.9 3.2 1.3-6.6L2.5 9.5l6.6-.8z" fill="${on ? '#ffcf5a' : 'rgba(255,255,255,0.35)'}" stroke="${on ? '#e0a400' : 'rgba(0,0,0,0.25)'}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const svgLock = `<svg viewBox="0 0 24 24" width="34" height="34"><rect x="5" y="10" width="14" height="11" rx="3" fill="#fff" opacity="0.9"/><path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const svgBack = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>`;
const svgGear = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`;
const svgCoin = (size = 18): string => `<svg viewBox="0 0 24 24" width="${size}" height="${size}"><circle cx="12" cy="12" r="10" fill="#ffcf5a" stroke="#c98a12" stroke-width="1.5"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#fff3c4" stroke-width="1.8"/></svg>`;
const svgShop = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10l1.2-5h13.6L20 10"/><path d="M5 10v9h14v-9"/><path d="M9 19v-5h6v5"/></svg>`;
const svgLogo = `<svg viewBox="0 0 120 84" fill="none">
  <ellipse cx="60" cy="70" rx="44" ry="8" fill="rgba(0,20,60,0.25)"/>
  <path d="M18 46c0-8 7-13 15-11 3-9 12-14 21-11 5-8 17-9 23-2 9-2 17 4 17 12 7 1 11 6 11 12 0 7-6 12-13 12H30c-7 0-12-5-12-12z" fill="#ffffff" opacity="0.95"/>
  <path d="M30 40c6-6 14-7 20-3" stroke="#cfe6ff" stroke-width="3" stroke-linecap="round"/>
  <g transform="translate(60 38) rotate(-18)">
    <path d="M-26 0h46c6 0 10 2 10 4s-4 4-10 4h-46c-3 0-5-2-5-4s2-4 5-4z" fill="#ff7a59"/>
    <path d="M-8 -2l-14 -16h7l20 16z" fill="#ffb59c"/>
    <path d="M-8 10l-14 16h7l20 -16z" fill="#ffb59c"/>
    <path d="M-24 0l-8 -10h5l12 10z" fill="#ff5a3c"/>
    <circle cx="16" cy="4" r="2.2" fill="#12294a"/><circle cx="8" cy="4" r="2.2" fill="#12294a"/><circle cx="0" cy="4" r="2.2" fill="#12294a"/>
  </g>
</svg>`;

const tutSvg = [
  `<svg viewBox="0 0 54 54"><rect x="0" y="0" width="54" height="54" rx="14" fill="#e6f3ff"/><path d="M12 40c8-14 14-16 30-26" stroke="#5ad1a5" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 4" fill="none"/><circle cx="12" cy="40" r="5" fill="#ff7a59"/><rect x="38" y="6" width="8" height="18" rx="2" fill="#6b7280"/><path d="M42 26l-3 5h6z" fill="#5ad1a5"/></svg>`,
  `<svg viewBox="0 0 54 54"><rect x="0" y="0" width="54" height="54" rx="14" fill="#fff0f0"/><circle cx="20" cy="27" r="12" fill="none" stroke="#ff5a6e" stroke-width="2.5"/><circle cx="36" cy="27" r="12" fill="none" stroke="#ff5a6e" stroke-width="2.5"/><circle cx="20" cy="27" r="3" fill="#ff5a6e"/><circle cx="36" cy="27" r="3" fill="#ff5a6e"/><rect x="21" y="38" width="14" height="8" rx="4" fill="#12294a"/><text x="28" y="44.5" font-size="6.5" font-weight="900" fill="#fff" text-anchor="middle" font-family="Nunito, sans-serif">60 m</text></svg>`,
  `<svg viewBox="0 0 54 54"><rect x="0" y="0" width="54" height="54" rx="14" fill="#f4eefe"/><path d="M10 34h34c2 0 3 1 3 2s-1 2-3 2H10c-1 0-2-1-2-2s1-2 2-2z" fill="#7c5cff"/><path d="M24 34l-10-12h5l14 12z" fill="#b7a5ff"/><path d="M24 38l-10 12h5l14-12z" fill="#b7a5ff"/><circle cx="41" cy="16" r="7" fill="none" stroke="#5ad1a5" stroke-width="2.5"/><text x="41" y="19" font-size="8" font-weight="900" fill="#5ad1a5" text-anchor="middle" font-family="Nunito, sans-serif">H</text></svg>`,
];

function coinBadge(): string {
  return `<span class="coinbadge">${svgCoin(18)}<b>${save.coins}</b></span>`;
}

export class UI {
  root: HTMLElement;
  private current: HTMLElement | null = null;
  private onDestroy: (() => void) | null = null;

  constructor(private actions: UIActions) {
    this.root = document.getElementById('ui')!;
  }

  clear(): void {
    if (this.onDestroy) { this.onDestroy(); this.onDestroy = null; }
    this.root.innerHTML = '';
    this.current = null;
  }

  private mount(el: HTMLElement, destroy?: () => void): void {
    this.clear();
    this.root.appendChild(el);
    this.current = el;
    this.onDestroy = destroy ?? null;
    el.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', () => { sfx.unlock(); sfx.tap(); }));
  }

  get isOpen(): boolean { return !!this.current; }

  private screen(cls = 'dim'): HTMLDivElement {
    const s = document.createElement('div'); s.className = `screen ${cls}`; return s;
  }

  private topbar(title: string, onBack: () => void, right?: { icon: string; onClick: () => void }): HTMLDivElement {
    const bar = document.createElement('div'); bar.className = 'topbar';
    bar.innerHTML = `<button class="iconbtn" data-a="back">${svgBack}</button><h2>${title}</h2>${right ? `<button class="iconbtn" data-a="right">${right.icon}</button>` : '<span style="width:46px"></span>'}`;
    bar.querySelector('[data-a=back]')!.addEventListener('click', onBack);
    if (right) bar.querySelector('[data-a=right]')!.addEventListener('click', right.onClick);
    return bar;
  }

  title(): void {
    const s = this.screen('');
    const stars = grandTotalStars();
    s.innerHTML = `
      <div class="logo">${svgLogo}<div class="word">Cloudhopper</div><div class="tag">${lang() === 'nl' ? 'Breng elk toestel veilig thuis' : 'Bring every plane safely home'}</div></div>
      <div class="card" style="text-align:center">
        <div class="statrow"><span>${svgStar(true, 18)}<b>${stars}</b> / ${MAX_STARS}</span>${coinBadge()}</div>
        <div class="stack" style="margin-top:12px">
          <button class="btn" data-a="play">${t('journey')}</button>
          <div class="row" style="margin-top:0"><button class="btn secondary" data-a="fleet">${t('fleet')}</button><button class="btn secondary" data-a="settings">${t('settings')}</button></div>
          <div class="row" style="margin-top:0"><button class="btn quiet" data-a="parents">${t('parents')}</button></div>
        </div>
      </div>`;
    s.querySelector('[data-a=play]')!.addEventListener('click', () => this.actions.toWorlds());
    s.querySelector('[data-a=fleet]')!.addEventListener('click', () => this.actions.openFleet());
    s.querySelector('[data-a=settings]')!.addEventListener('click', () => this.actions.openSettings());
    s.querySelector('[data-a=parents]')!.addEventListener('click', () => this.actions.openParents());
    this.mount(s);
  }

  /** Real-world airports: one card per field, four difficulty steps each. */
  ports(back: () => void): void {
    const s = this.screen('dim top');
    s.appendChild(this.topbar(t('realPorts'), back));
    const have = grandTotalStars();
    const head = document.createElement('div'); head.className = 'statrow light';
    head.innerHTML = `<span>${svgStar(true, 18)}<b>${have}</b> / ${MAX_STARS}</span>${coinBadge()}`;
    s.appendChild(head);
    const grid = document.createElement('div'); grid.className = 'grid';
    for (const p of PORTS_IN_ORDER) {
      const done = [0, 1, 2, 3].map(k => levelProgress(realId(p.id, k)));
      const stars = portStars(p.id);
      const open = portUnlocked(p);
      const firstOpen = done.findIndex(d => !d.completed);
      const nextStep = firstOpen === -1 ? 3 : firstOpen;
      const b = document.createElement('button'); b.className = `level port${open ? '' : ' locked'}`;
      const c = document.createElement('canvas'); c.width = 300; c.height = 384;
      b.appendChild(c);
      this.actions.makePortThumb(p.id, c);
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.innerHTML = `<div class="name">${p.name}</div><div class="info"><span>${p.city} · ${p.country}</span></div>` +
        `<div class="info"><span>${svgStar(true, 12)} ${stars} / 12</span><span>${p.runways.length} ${lang() === 'nl' ? (p.runways.length === 1 ? 'baan' : 'banen') : (p.runways.length === 1 ? 'runway' : 'runways')}</span></div>` +
        // the "still locked" line belongs with the other facts at the foot of the card; centred
        // under the padlock it landed straight on top of them
        (open ? '' : `<div class="lockline">${p.unlockAt - have} ${t('starsToUnlock')}</div>`);
      b.appendChild(meta);
      const code = document.createElement('div'); code.className = 'icao'; code.textContent = p.iata; b.appendChild(code);
      const dots = document.createElement('div'); dots.className = 'steps';
      dots.innerHTML = [0, 1, 2, 3].map(k => `<i class="${done[k].completed ? 'on' : ''}"></i>`).join('');
      b.appendChild(dots);
      if (!open) {
        const lock = document.createElement('div'); lock.className = 'lock';
        lock.innerHTML = svgLock;
        b.appendChild(lock);
      }
      b.addEventListener('click', () => {
        if (!open) { this.toast(t('lockedPort')); return; }
        if (!portMissionUnlocked(p, nextStep)) { this.toast(t('finishPrevious')); return; }
        this.actions.startReal(p.id, nextStep);
      });
      grid.appendChild(b);
    }
    s.appendChild(grid);
    this.mount(s);
  }

  /** Gallery of every real aircraft in the game, drawn live, with the island it first appears on. */
  fleet(back: () => void): void {
    const s = this.screen('dim top');
    s.appendChild(this.topbar(t('fleet'), back));
    const families: Array<[string, string, string]> = [
      ['ga', 'Kleine luchtvaart', 'General aviation'], ['turboprop', 'Turboprops', 'Turboprops'], ['regional', 'Regionale jets', 'Regional jets'],
      ['bizjet', 'Zakenjets', 'Business jets'], ['narrow', 'Narrowbody', 'Narrowbody'], ['wide', 'Widebody', 'Widebody'],
      ['sea', 'Watervliegtuigen', 'Seaplanes'], ['heli', 'Helikopters', 'Helicopters'], ['fighter', 'Straaljagers', 'Fighters'], ['miltransport', 'Militair transport', 'Military transport'],
    ];
    const wrap = document.createElement('div'); wrap.style.cssText = 'width:min(560px,100%);display:flex;flex-direction:column;gap:14px;';
    const canvases: Array<{ c: HTMLCanvasElement; id: string }> = [];
    for (const [fam, nlName, enName] of families) {
      const types = Object.values(PLANE_TYPES).filter(p => p.family === fam);
      if (!types.length) continue;
      const sec = document.createElement('div');
      sec.innerHTML = `<div class="sub" style="color:#fff;text-shadow:0 2px 8px rgba(0,30,80,.5);margin:0 0 8px 4px">${lang() === 'nl' ? nlName : enName}</div>`;
      const grid = document.createElement('div'); grid.className = 'fleetgrid';
      for (const p of types) {
        const fa = firstAppearance(p.id);
        const unlocked = fa ? worldUnlocked(fa.worldIndex) : true;
        const card = document.createElement('div'); card.className = `fleetcard${unlocked ? '' : ' locked'}`;
        const c = document.createElement('canvas'); c.width = 240; c.height = 150; canvases.push({ c, id: p.id });
        const where = fa ? `${worldName(WORLDS[fa.worldIndex])} · ${t('mission').toLowerCase()} ${fa.index + 1}` : '-';
        card.appendChild(c);
        card.insertAdjacentHTML('beforeend', `<div class="fname">${p.name}</div><div class="fmeta">${p.maker}${p.military ? ' · ' + (lang() === 'nl' ? 'militair' : 'military') : ''}</div>
          <div class="fstats"><span>${displayKmh(p.speed)} km/u</span><span>${t('crosswind')} ${p.crosswindLimit}</span><span>${p.ils ? 'ILS' : (lang() === 'nl' ? 'visueel' : 'visual')}</span></div>
          <div class="fmeta">${t('appearsOn')}: ${where}</div>`);
        grid.appendChild(card);
      }
      sec.appendChild(grid); wrap.appendChild(sec);
    }
    s.appendChild(wrap);
    this.mount(s);
    let tick = 0;
    const draw = (): void => {
      tick += 0.016;
      for (const { c, id } of canvases) {
        const type = PLANE_TYPES[id];
        const ctx = c.getContext('2d')!;
        ctx.clearRect(0, 0, c.width, c.height);
        const scale = Math.min(200 / (type.shape.L * 1.05), 120 / Math.max(type.shape.span, type.hull * 3.4));
        ctx.save(); ctx.translate(c.width / 2, c.height / 2 + 4); ctx.scale(scale, scale);
        drawPlane(ctx, { type, pos: { x: 0, y: 0 }, heading: -Math.PI / 2, altitude: 1, bank: 0, livery: 0, state: 'flying', id: 1 }, tick, false);
        ctx.restore();
      }
      if (this.current === s) requestAnimationFrame(draw);
    };
    draw();
  }

  /**
   * The whole journey in one list: every island and every real airport, in the order they open.
   *
   * There used to be two buttons on the title screen - islands, or a world tour - which asked a
   * child to choose between two things before knowing what either one was. There is one road now,
   * and the next place on it is marked.
   */
  worlds(): void {
    const s = this.screen('dim top');
    s.appendChild(this.topbar(t('journey'), () => this.actions.toTitle()));
    const have = grandTotalStars();
    const head = document.createElement('div'); head.className = 'statrow light';
    head.innerHTML = `<span>${svgStar(true, 18)}<b>${have}</b> / ${MAX_STARS}</span>${coinBadge()}`;
    s.appendChild(head);
    const grid = document.createElement('div'); grid.className = 'grid';
    const stops = route();
    const now = routeNow();
    stops.forEach((stop, idx) => {
      const open = stopOpen(stop);
      const b = document.createElement('button');
      b.className = `level${open ? '' : ' locked'}${idx === now ? ' here' : ''}`;
      const c = document.createElement('canvas'); c.width = 300; c.height = 384;
      b.appendChild(c);
      const meta = document.createElement('div'); meta.className = 'meta';

      if (stop.kind === 'island') {
        const lv = WORLDS[stop.world];
        this.actions.makeThumb(stop.world, c);
        const stars = worldStars(stop.world);
        meta.innerHTML = `<div class="name">${worldName(lv)}</div>`
          + `<div class="info"><span>${lang() === 'nl' ? lv.subtitle : lv.subtitleEn}</span></div>`
          + `<div class="info"><span>${svgStar(true, 12)} ${stars} / ${LEVELS_PER_WORLD * 3}</span><span>${LEVELS_PER_WORLD} ${t('missions').toLowerCase()}</span></div>`
          + (open ? '' : `<div class="lockline">${stopShort(stop)} ${t('starsToUnlock')}</div>`);
        b.appendChild(meta);
        b.addEventListener('click', () => { if (open) this.actions.toMissions(stop.world); else this.toast(t('worldLocked')); });
      } else {
        const p = stop.port;
        this.actions.makePortThumb(p.id, c);
        const done = [0, 1, 2, 3].map(k => levelProgress(realId(p.id, k)));
        const firstOpen = done.findIndex(d => !d.completed);
        const nextStep = firstOpen === -1 ? 3 : firstOpen;
        meta.innerHTML = `<div class="name">${p.name}</div>`
          + `<div class="info"><span>${p.city} · ${p.country}</span></div>`
          + `<div class="info"><span>${svgStar(true, 12)} ${portStars(p.id)} / 12</span><span>${p.runways.length} ${lang() === 'nl' ? (p.runways.length === 1 ? 'baan' : 'banen') : (p.runways.length === 1 ? 'runway' : 'runways')}</span></div>`
          + (open ? '' : `<div class="lockline">${stopShort(stop)} ${t('starsToUnlock')}</div>`);
        b.appendChild(meta);
        const code = document.createElement('div'); code.className = 'icao'; code.textContent = p.iata; b.appendChild(code);
        const dots = document.createElement('div'); dots.className = 'steps';
        dots.innerHTML = [0, 1, 2, 3].map(k => `<i class="${done[k].completed ? 'on' : ''}"></i>`).join('');
        b.appendChild(dots);
        b.addEventListener('click', () => {
          if (!open) { this.toast(t('lockedPort')); return; }
          if (!portMissionUnlocked(p, nextStep)) { this.toast(t('finishPrevious')); return; }
          this.actions.startReal(p.id, nextStep);
        });
      }
      // every stop is numbered, islands and real fields alike, so the road reads as one road
      const num = document.createElement('div'); num.className = 'num'; num.textContent = String(idx + 1); b.appendChild(num);
      if (idx === now) { const tag = document.createElement('div'); tag.className = 'here-tag'; tag.textContent = t('youAreHere'); b.appendChild(tag); }
      if (!open) { const lock = document.createElement('div'); lock.className = 'lock'; lock.innerHTML = svgLock; b.appendChild(lock); }
      grid.appendChild(b);
    });
    s.appendChild(grid);
    this.mount(s);
  }

  missions(worldIndex: number): void {
    const world = WORLDS[worldIndex];
    const s = this.screen('dim top');
    s.appendChild(this.topbar(worldName(world), () => this.actions.toWorlds()));
    const head = document.createElement('div'); head.className = 'statrow light';
    head.innerHTML = `<span>${svgStar(true, 18)}<b>${worldStars(worldIndex)}</b> / ${LEVELS_PER_WORLD * 3}</span>${coinBadge()}`;
    s.appendChild(head);
    const grid = document.createElement('div'); grid.className = 'mgrid';
    for (let i = 0; i < LEVELS_PER_WORLD; i++) {
      const m = buildMission(worldIndex, i);
      const prog = levelProgress(missionId(world.id, i));
      const unlocked = missionUnlocked(worldIndex, i);
      const b = document.createElement('button'); b.className = `mission${unlocked ? '' : ' locked'}${prog.completed ? ' done' : ''} t-${m.time}`;
      b.innerHTML = unlocked
        ? `<div class="mnum">${i + 1}</div><div class="mtag">${m.subtitle}</div><div class="mstars">${[1, 2, 3].map(k => svgStar(prog.stars >= k, 14)).join('')}</div><div class="mgoal">${t('goal')} ${m.goal}</div>`
        : `<div class="mnum">${i + 1}</div>${svgLock}`;
      b.addEventListener('click', () => { if (unlocked) this.actions.startMission(worldIndex, i); });
      grid.appendChild(b);
    }
    s.appendChild(grid);
    this.mount(s);
  }

  shop(back: () => void): void {
    const s = this.screen('dim top');
    s.appendChild(this.topbar(t('buildTitle'), back));
    const card = document.createElement('div'); card.className = 'card wide';
    const render = (): void => {
      card.innerHTML = `<div class="statrow"><span class="sub">${t('upgrades')}</span>${coinBadge()}</div>
        <div class="shoplist">${UPGRADES.map(u => {
          const lvl = upgradeLevel(u.id), cost = nextCost(u.id), max = u.costs.length;
          const can = cost !== null && save.coins >= cost;
          return `<div class="shopitem">
            <div class="shopinfo"><div class="shopname">${upgradeName(u)} <span class="tier">${'●'.repeat(lvl)}${'○'.repeat(max - lvl)}</span></div><div class="shopdesc">${upgradeDesc(u)}</div></div>
            <button class="btn small ${cost === null ? 'secondary' : can ? 'mint' : 'secondary'}" data-buy="${u.id}" ${cost === null ? 'disabled' : ''}>${cost === null ? t('maxed') : `${svgCoin(14)} ${cost}`}</button>
          </div>`;
        }).join('')}</div>`;
      card.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', () => {
        const id = (b as HTMLElement).dataset.buy!;
        if (buyUpgrade(id)) { sfx.coin(0); sfx.coin(1); sfx.coin(2); render(); } else this.toast(t('notEnough'));
      }));
      card.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', () => sfx.tap()));
    };
    render();
    s.appendChild(card);
    this.mount(s);
  }

  toast(text: string): void {
    const el = document.createElement('div');
    el.className = 'card'; el.style.cssText = 'position:absolute;left:50%;bottom:calc(var(--sab) + 24px);transform:translateX(-50%);padding:12px 18px;width:auto;max-width:90%;font-weight:800;pointer-events:none;';
    el.textContent = text;
    this.root.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  }

  tutorial(): void {
    const s = this.screen();
    s.innerHTML = `<div class="card"><h2>${t('tutorialTitle')}</h2>
      <div class="tut">
        <div class="step">${tutSvg[0]}<p>${t('tutorial1')}</p></div>
        <div class="step">${tutSvg[1]}<p>${t('tutorial2')}</p></div>
        <div class="step">${tutSvg[2]}<p>${t('tutorial3')}</p></div>
      </div>
      <div class="stack"><button class="btn mint" data-a="ok">${t('gotIt')}</button></div></div>`;
    s.querySelector('[data-a=ok]')!.addEventListener('click', () => this.actions.tutorialDone());
    this.mount(s);
  }

  pause(levelName: string): void {
    const s = this.screen();
    s.innerHTML = `<div class="card" style="text-align:center"><div class="sub">${levelName}</div><h1>${t('pause')}</h1>
      <div class="stack">
        <button class="btn mint" data-a="resume">${t('resume')}</button>
        <button class="btn secondary" data-a="retry">${t('retry')}</button>
        <button class="btn secondary" data-a="levels">${t('missions')}</button>
      </div></div>`;
    s.querySelector('[data-a=resume]')!.addEventListener('click', () => this.actions.resume());
    s.querySelector('[data-a=retry]')!.addEventListener('click', () => this.actions.retry());
    s.querySelector('[data-a=levels]')!.addEventListener('click', () => this.actions.toWorlds());
    this.mount(s);
  }

  complete(opts: { levelName: string; landed: number; stars: number; newBest: boolean; hasNext: boolean; goal: number; coins: number; canDouble: boolean }): void {
    const s = this.screen();
    s.innerHTML = `<div class="card result"><div class="sub">${opts.levelName}</div><h1>${t('levelComplete')}</h1>
      <div class="stars">${[1, 2, 3].map(k => svgStar(opts.stars >= k, 40)).join('')}</div>
      <div class="big">${opts.landed}</div><p>${t('landed').toLowerCase()} · ${t('goal').toLowerCase()} ${opts.goal}</p>
      <div class="coinsline">${svgCoin(22)} <b data-coins>+${opts.coins}</b> ${t('coins')}${opts.newBest ? ` <span class="pill gold">${t('newBest')}</span>` : ''}</div>
      <div class="stack">
        ${opts.hasNext ? `<button class="btn mint" data-a="next">${t('nextMission')}</button>` : ''}
        <button class="btn gold" data-a="build">${svgShop}<span>${t('upgrades')}</span>${svgCoin(18)}<b>${save.coins}</b></button>
        <div class="row" style="margin-top:0"><button class="btn secondary" data-a="continue">${t('continue')}</button><button class="btn secondary" data-a="levels">${t('missions')}</button></div>
      </div></div>`;
    // the coins land here, so this is where they can be spent - the same list the tower shows in-game
    s.querySelector('[data-a=build]')!.addEventListener('click', () => this.shop(() => this.complete(opts)));
    s.querySelector('[data-a=continue]')!.addEventListener('click', () => this.actions.continueEndless());
    s.querySelector('[data-a=next]')?.addEventListener('click', () => this.actions.next());
    s.querySelector('[data-a=levels]')!.addEventListener('click', () => this.actions.toWorlds());
    this.mount(s);
  }

  /** Update the coin line after a rewarded ad. */
  setCoinsLine(coins: number): void {
    const el = this.root.querySelector('[data-coins]'); if (el) el.textContent = `+${coins}`;
    this.root.querySelector('[data-a=double]')?.remove();
  }

  failed(report: Report, replayEl: HTMLElement, destroyReplay: () => void, landed: number, canRevive: boolean): void {
    const s = this.screen('dim top');
    const card = document.createElement('div'); card.className = 'card wide report';
    const fmt = (sec: number): string => `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}`;
    card.innerHTML = `
      <div class="sub">${t('missionFailed')} · ${landed} ${t('landed').toLowerCase()}</div>
      <h2>${report.title}</h2>
      <div class="headline">${report.headline}</div>
      ${canRevive ? `<button class="btn" data-a="revive" style="margin-top:10px">${t('revive')}</button>` : ''}
      <div class="tabs"><button class="on" data-tab="replay">${t('replay')}</button><button data-tab="why">${t('whatWentWrong')}</button><button data-tab="timeline">${t('timeline')}</button></div>
      <div data-pane="replay"></div>
      <div data-pane="why" class="hidden">
        ${report.causes.map(c => `<div class="cause">${c}</div>`).join('')}
        <div class="sub" style="margin-top:12px">${t('tips')}</div>
        <ul>${report.tips.map(x => `<li>${x}</li>`).join('')}</ul>
      </div>
      <div data-pane="timeline" class="hidden"><div class="timeline">${report.timeline.map(e => `<div class="ev${e.bad ? ' bad' : ''}"><span class="t">${fmt(e.t)}</span><span>${e.text}</span></div>`).join('') || '<p>-</p>'}</div></div>
      <div class="row"><button class="btn ${canRevive ? 'secondary' : ''}" data-a="retry">${t('retry')}</button><button class="btn secondary" data-a="levels">${t('missions')}</button></div>`;
    card.querySelector('[data-pane=replay]')!.appendChild(replayEl);
    const short = document.createElement('div');
    short.className = 'cause'; short.innerHTML = report.causes[0] ?? '';
    card.querySelector('[data-pane=replay]')!.appendChild(short);
    card.querySelectorAll('[data-tab]').forEach(btn => btn.addEventListener('click', () => {
      card.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('on', b === btn));
      const tab = (btn as HTMLElement).dataset.tab;
      card.querySelectorAll('[data-pane]').forEach(p => p.classList.toggle('hidden', (p as HTMLElement).dataset.pane !== tab));
    }));
    card.querySelector('[data-a=retry]')!.addEventListener('click', () => this.actions.retry());
    card.querySelector('[data-a=levels]')!.addEventListener('click', () => this.actions.toWorlds());
    card.querySelector('[data-a=revive]')?.addEventListener('click', () => this.actions.revive());
    s.appendChild(card);
    this.mount(s, destroyReplay);
  }

  /**
   * The parent corner. Every game in Bramblewood gets one: what it practises, how a session is
   * shaped, and what we do not claim. This is the page that earns a subscription, so it stays honest.
   */
  parents(): void {
    const s = this.screen();
    s.appendChild(this.topbar(t('parents'), () => this.actions.closeParents()));
    const card = document.createElement('div'); card.className = 'card wide';
    const skill = (n: 1 | 2 | 3 | 4): string =>
      `<li><b>${t(`pSkill${n}`)}</b><span>${t(`pSkill${n}d`)}</span></li>`;
    const block = (head: string, body: string): string =>
      `<div class="pblock"><div class="sub">${head}</div><p>${body}</p></div>`;
    card.innerHTML = `
      <p class="headline">${t('parentsIntro')}</p>
      <div class="pblock"><div class="sub">${t('pWhat')}</div>
        <ul class="skills">${skill(1)}${skill(2)}${skill(3)}${skill(4)}</ul></div>
      ${block(t('pAge'), t('pAgeVal'))}
      ${block(t('pSession'), t('pSessionVal'))}
      ${block(t('pPrivacy'), t('pPrivacyVal'))}
      ${block(t('pHonest'), t('pHonestVal'))}
      <div class="stack"><button class="btn secondary" data-a="back">${t('back')}</button></div>`;
    card.querySelector('[data-a=back]')!.addEventListener('click', () => this.actions.closeParents());
    card.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', () => sfx.tap()));
    s.appendChild(card);
    this.mount(s);
  }

  settings(): void {
    const s = this.screen();
    const card = document.createElement('div'); card.className = 'card';
    const render = (): void => {
      const toggle = (k: 'sound' | 'music' | 'radio' | 'haptics', label: string): string => `<div class="toggle"><span>${label}</span><button class="switch ${save[k] ? 'on' : ''}" data-k="${k}" aria-label="${label}"></button></div>`;
      card.innerHTML = `<h2>${t('settings')}</h2>
        ${toggle('sound', t('sound'))}${toggle('music', t('music'))}${toggle('radio', t('radio'))}${toggle('haptics', t('haptics'))}
        <div class="toggle"><span>${t('language')}</span><div class="seg">
          <button data-l="auto" class="${save.lang === 'auto' ? 'on' : ''}">Auto</button>
          <button data-l="nl" class="${save.lang === 'nl' ? 'on' : ''}">NL</button>
          <button data-l="en" class="${save.lang === 'en' ? 'on' : ''}">EN</button></div></div>
        <div class="stack"><button class="btn secondary" data-a="back">${t('back')}</button></div>`;
      card.querySelectorAll('[data-k]').forEach(b => b.addEventListener('click', () => {
        const k = (b as HTMLElement).dataset.k as 'sound' | 'music' | 'radio' | 'haptics';
        save[k] = !save[k]; persist(); render();
      }));
      card.querySelectorAll('[data-l]').forEach(b => b.addEventListener('click', () => {
        save.lang = (b as HTMLElement).dataset.l as 'auto' | 'nl' | 'en'; persist(); render();
      }));
      card.querySelector('[data-a=back]')!.addEventListener('click', () => this.actions.closeSettings());
      card.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', () => sfx.tap()));
    };
    render();
    s.appendChild(card);
    this.mount(s);
  }
}
