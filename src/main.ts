import './style.css';

import { toggleWeatherDetail } from './render/hud';
import { addBackButton, addHomeButton } from './hub/homebtn';
import { Input } from './game/input';
import { buildMission, coinsForRun, missionId, nextMission, starsForRun, WORLDS } from './game/progress';
import { realLevel, realPortById, REAL_PORTS } from './game/realports';
import { lang } from './i18n';
import { buildReport } from './game/postmortem';
import { World } from './game/world';
import type { GameEvent } from './game/types';
import { PALETTES } from './render/palette';
import { Renderer } from './render/renderer';
import { ReplayView } from './ui/replay';
import { UI, type UIActions } from './ui/screens';
import { addCoins, levelProgress, persist, recordLevelResult, save } from './util/storage';
import { Ambience, EngineMixer, Radio, runwayCallout, runwayIdCallout, sfx, unlockAudio } from './util/audio';

type Mode = 'title' | 'worlds' | 'missions' | 'building' | 'fleet' | 'ports' | 'tutorial' | 'playing' | 'paused' | 'complete' | 'failed' | 'settings' | 'parents';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const ambience = new Ambience();
const engines = new EngineMixer();
const radio = new Radio();

let mode: Mode = 'title';
let prevMode: Mode = 'title';
let world: World;
let current = { worldIndex: 0, index: 0 };
let last = performance.now();
let clock = 0;
/** An extra life is bought with coins you earned, never with an advertisement. */
const REVIVE_COST = 75;
let runCoins = 0;
let currentPort: { id: string; step: number } | null = null;
let revivedThisRun = false;
let lastThunder = -1;

function makeDemoWorld(): World {
  const unlocked = WORLDS.filter((_, i) => i === 0 || levelProgress(missionId(WORLDS[i - 1].id, 0)).completed);
  const pick = unlocked[Math.floor(Math.random() * unlocked.length)] ?? WORLDS[0];
  const w = new World(pick, renderer.suggestWorldWidth(), { demo: true });
  renderer.setWorld(w);
  engines.clear();
  ambience.setMode('menu', pick.time !== 'night');
  return w;
}

/** The tower takes the name of the field: a real airport uses its own, the archipelago uses Bramblewood. */
function towerName(): string {
  return world.level.port ? world.level.port.name : 'Bramblewood';
}

function onWorldEvent(e: GameEvent): void {
  const p = world.planeById(e.planes[0]);
  const type = p?.type;
  if (!type) return;
  const cs = radio.callsign(type, e.planes[0]);
  switch (e.kind) {
    case 'spawn':
      if (!p?.urgent) radio.say(`${towerName()} Tower, ${cs}, inbound for landing.`, { who: 'pilot' });
      break;
    case 'mayday':
      radio.say(`Mayday, mayday, ${towerName()} Tower, ${cs}, ${type.family === 'fighter' ? 'bingo fuel' : 'minimum fuel'}, request priority landing.`, { who: 'pilot', urgent: true });
      break;
    case 'lock': {
      const rw = world.runwayById(String(e.meta?.runway ?? ''));
      if (rw) radio.say(rw.kind === 'helipad' ? `${cs}, cleared to land helipad, wind ${Math.round(world.wind.kmh)} kilometers.` : `${cs}, cleared to land runway ${/^\d{2}[LCR]?$/.test(rw.id) ? runwayIdCallout(rw.id) : runwayCallout(rw.heading)}, wind ${Math.round(world.wind.kmh)} kilometers.`);
      break;
    }
    case 'touchdown': sfx.touchdown(type.cls === 'heavy' || type.cls === 'medium' || type.cls === 'fast'); break;
    case 'landed': radio.say(p?.urgent ? `${cs}, welcome home, emergency services are standing by.` : `${cs}, welcome to ${towerName()}, taxi to the apron.`); break;
    case 'goaround': radio.say(`${cs}, go around, I say again, go around.`, { urgent: true }); break;
    case 'nearmiss': radio.say(`Traffic alert, ${cs}, traffic, turn immediately.`, { urgent: true }); break;
    case 'ditch': radio.say(`${cs} is going down, ditching, ditching.`, { who: 'pilot', urgent: true }); break;
    case 'taxi': { const g = Number(e.meta?.gate ?? -1); radio.say(g > 0 && g < 100 ? `${cs}, taxi to gate ${g} via alpha.` : `${cs}, taxi to the apron via alpha.`); break; }
    case 'pushback': radio.say(`${cs}, pushback approved.`); break;
    case 'takeoff': { const dr = world.runwayById(p?.departRunway ?? p?.airportId ?? ''); radio.say(`${cs}, wind ${Math.round(world.wind.kmh)} kilometers, runway ${dr && /^\d{2}[LCR]?$/.test(dr.id) ? runwayIdCallout(dr.id) : runwayCallout(dr?.heading ?? 0)}, cleared for take-off.`); break; }
    case 'command': {
      const c = String(e.meta?.cmd);
      if (c === 'faster') { radio.say(`${cs}, increase speed, expedite.`); radio.say(`Increasing speed, ${cs}.`, { who: 'pilot' }); }
      else if (c === 'slower') { radio.say(`${cs}, reduce speed, minimum clean.`); radio.say(`Reducing speed, ${cs}.`, { who: 'pilot' }); }
      else if (c === 'tcas') { radio.say(`${cs}, TCAS RA, turning to avoid traffic.`, { who: 'pilot', urgent: true }); }
      else if (c === 'hold') { radio.say(`${cs}, hold present position, expect further clearance.`); }
      break;
    }
    case 'crash': radio.stop(); break;
  }
}

function startMission(worldIndex: number, index: number): void {
  const lv = buildMission(worldIndex, index);
  current = { worldIndex, index };
  currentPort = null;
  world = new World(lv, renderer.suggestWorldWidth());
  world.onEvent = onWorldEvent;
  renderer.setWorld(world);
  input.cancelAll();
  ui.clear();
  runCoins = 0; revivedThisRun = false;
  radio.stop();
  ambience.setMode('game', lv.time !== 'night');
  mode = 'playing';
  last = performance.now();
}

function startRealMission(portId: string, step: number): void {
  const port = realPortById(portId);
  if (!port) return;
  const lv = realLevel(port, Math.max(0, Math.min(3, step)), lang() === 'nl', renderer.suggestWorldWidth(), 1600);
  currentPort = { id: portId, step: Math.max(0, Math.min(3, step)) };
  world = new World(lv, renderer.suggestWorldWidth());
  world.onEvent = onWorldEvent;
  renderer.setWorld(world);
  input.cancelAll();
  ui.clear();
  runCoins = 0; revivedThisRun = false;
  radio.stop();
  ambience.setMode('game', lv.time !== 'night');
  mode = 'playing';
  last = performance.now();
}

function gotoPorts(): void { world = makeDemoWorld(); mode = 'ports'; ui.ports(() => { mode = 'title'; ui.title(); }); }

function gotoWorlds(): void { world = makeDemoWorld(); mode = 'worlds'; ui.worlds(); }

/**
 * Cloudhopper carries no advertising. Nothing interrupts a level, nothing tracks a child, and the
 * app stays inside Apple's Kids category rules. This hook exists so the flow between levels has one
 * place to hang on to.
 */
async function afterLevelAd(next: () => void): Promise<void> { next(); }

const actions: UIActions = {
  startMission(w, i) {
    if (!save.tutorialSeen) { current = { worldIndex: w, index: i }; mode = 'tutorial'; ui.tutorial(); return; }
    startMission(w, i);
  },
  tutorialDone() { save.tutorialSeen = true; persist(); if (currentPort) startRealMission(currentPort.id, currentPort.step); else startMission(current.worldIndex, current.index); },
  resume() { ui.clear(); mode = 'playing'; last = performance.now(); },
  retry() { const cp = currentPort; void afterLevelAd(() => (cp ? startRealMission(cp.id, cp.step) : startMission(current.worldIndex, current.index))); },
  next() {
    if (currentPort) {
      const cp = currentPort;
      if (cp.step < 3) void afterLevelAd(() => startRealMission(cp.id, cp.step + 1));
      else {
        const i = REAL_PORTS.findIndex(p => p.id === cp.id);
        const nx = REAL_PORTS[(i + 1) % REAL_PORTS.length];
        void afterLevelAd(() => startRealMission(nx.id, 0));
      }
      return;
    }
    const n = nextMission(current.worldIndex, current.index);
    if (n) void afterLevelAd(() => startMission(n.worldIndex, n.index)); else void afterLevelAd(() => gotoWorlds());
  },
  toWorlds() { const cp = currentPort; void afterLevelAd(() => (cp ? gotoPorts() : gotoWorlds())); },
  toMissions(w) { if (!world.demo) world = makeDemoWorld(); current.worldIndex = w; mode = 'missions'; ui.missions(w); },
  toTitle() { world = makeDemoWorld(); mode = 'title'; ui.title(); },
  continueEndless() { world.continueEndless(); ui.clear(); mode = 'playing'; last = performance.now(); ambience.setMode('game', world.level.time !== 'night'); },
  openSettings() { prevMode = mode; mode = 'settings'; ui.settings(); },
  closeSettings() {
    mode = prevMode === 'settings' ? 'title' : prevMode;
    if (mode === 'title') ui.title(); else if (mode === 'worlds') ui.worlds(); else if (mode === 'missions') ui.missions(current.worldIndex); else if (mode === 'paused') ui.pause(world.level.name); else { mode = 'title'; ui.title(); }
  },
  openFleet() { prevMode = mode; mode = 'fleet'; ui.fleet(() => actions.closeFleet()); },
  openPorts() { gotoPorts(); },
  startReal(portId, step) {
    if (!save.tutorialSeen) { currentPort = { id: portId, step }; mode = 'tutorial'; ui.tutorial(); return; }
    startRealMission(portId, step);
  },
  makePortThumb(portId, c) {
    const port = realPortById(portId);
    if (!port) return;
    const lv = realLevel(port, 0, lang() === 'nl', 800, 1600);
    const w = new World(lv, 800, { demo: true });
    Renderer.drawThumbnail(c, w, PALETTES[lv.time]);
  },
  closeFleet() { mode = prevMode === 'fleet' || prevMode === 'settings' ? 'title' : prevMode; if (mode === 'worlds') ui.worlds(); else if (mode === 'missions') ui.missions(current.worldIndex); else { mode = 'title'; ui.title(); } },
  makeThumb(worldIndex, c) {
    const lv = WORLDS[worldIndex];
    const w = new World(lv, 800, { demo: true });
    Renderer.drawThumbnail(c, w, PALETTES[lv.time]);
  },
  openParents() { prevMode = mode; mode = 'parents'; ui.parents(); },
  closeParents() { mode = 'title'; ui.title(); },
  revive() {
    void (async () => {
      if (save.coins < REVIVE_COST) return;
      addCoins(-REVIVE_COST);
      revivedThisRun = true;
      world.revive();
      ui.clear(); mode = 'playing'; last = performance.now();
      ambience.setMode('game', world.level.time !== 'night');
    })();
  },
};
const ui = new UI(actions);

const input = new Input(canvas, () => (mode === 'playing' ? world : null), renderer, (sx, sy) => {
  if (mode !== 'playing') return false;
  const hit = renderer.hudHit(sx, sy);
  if (hit === 'pause') { pause(); return true; }
  if (hit === 'build') { openBuild(); return true; }
  if (hit === 'slowmo') { world.activateSlowmo(); return true; }
  if (hit && hit.startsWith('cmd:')) {
    const p = world.selected !== null ? world.planeById(world.selected) : undefined;
    if (p) { if (world.command(p, hit.slice(4) as 'faster' | 'slower' | 'tcas' | 'hold')) sfx.tap(); }
    return true;
  }
  if (hit === 'wxtoggle') { toggleWeatherDetail(); sfx.tap(); return true; }
  if (hit === 'panel') return true;
  return false;
});

/**
 * The build screen, opened from the tower during a shift.
 *
 * The upgrades used to live on their own tab, reached from the title screen, which meant a child
 * had to leave the game to spend what the game had just paid them. The shift holds still while the
 * screen is open and what is bought is working before the next aircraft calls in.
 */
function openBuild(): void {
  if (mode !== 'playing') return;
  mode = 'building';
  input.cancelAll();
  ui.shop(() => {
    world.applyUpgrades();
    ui.clear();
    mode = 'playing';
    last = performance.now();
  });
}

function pause(): void {
  if (mode !== 'playing') return;
  mode = 'paused';
  input.cancelAll();
  ui.pause(world.level.name);
}

function finishRunBookkeeping(completed: boolean): { stars: number; coins: number; newBest: boolean } {
  const stars = completed ? starsForRun(world.hearts, world.maxHearts) : 0;
  const before = levelProgress(world.level.id).best;
  recordLevelResult(world.level.id, world.landed, stars, completed);
  const coins = coinsForRun(world.landed, stars, world.fx.coinMultiplier);
  addCoins(coins);
  save.levelsPlayed++; save.totalLanded += world.landed; persist();
  return { stars, coins, newBest: world.landed > before };
}

function onComplete(): void {
  mode = 'complete';
  input.cancelAll();
  const r = finishRunBookkeeping(true);
  runCoins = r.coins;
  ambience.setMode('menu', world.level.time !== 'night');
  const n = currentPort ? true : nextMission(current.worldIndex, current.index);
  ui.complete({ levelName: world.level.name, landed: world.landed, stars: r.stars, newBest: r.newBest, hasNext: !!n, goal: world.level.goal, coins: r.coins, canDouble: false });
}

function onFailed(): void {
  mode = 'failed';
  input.cancelAll();
  radio.stop();
  const r = finishRunBookkeeping(world.goalReached);
  runCoins = r.coins;
  ambience.setMode('menu', world.level.time !== 'night');
  const report = buildReport(world);
  const replay = new ReplayView(world, renderer.terrain!, renderer.pal, report);
  ui.failed(report, replay.el, () => replay.destroy(), world.landed, !revivedThisRun && save.coins >= REVIVE_COST);
}

function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;
  if (mode === 'playing') {
    world.update(dt);
    if (world.status === 'complete') onComplete();
    else if (world.status === 'failed') onFailed();
  } else if (world.demo) {
    world.update(dt);
  }
  // audio follow-up
  const audible = mode === 'playing' || (world.demo && mode !== 'building' && mode !== 'settings' && mode !== 'fleet');
  engines.setMuted(!audible);
  engines.update(world.planes.filter(p => p.state === 'flying' || p.state === 'landing').map(p => ({ id: p.id, kind: p.type.engines, x: p.pos.x, y: p.pos.y, speed: p.speed, maxSpeed: p.type.speed, altitude: p.altitude, state: p.state })), world.timeScale);
  ambience.update(dt, mode === 'playing' || world.demo ? world.wind.kmh : 0, world.timeScale);
  ambience.setRain(mode === 'playing' || world.demo ? world.weather.cur.precip : 0);
  const fl = world.weather.flashes[world.weather.flashes.length - 1];
  if (fl && fl.t !== lastThunder && (mode === 'playing' || world.demo)) {
    lastThunder = fl.t;
    ambience.thunder(Math.min(1, Math.hypot(fl.x - world.W / 2, fl.y - world.H / 2) / world.H));
  }
  renderer.frame(world, clock, mode === 'playing' || world.demo ? dt * world.timeScale : 0, mode === 'playing' || mode === 'paused' || mode === 'building');
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 250));
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); radio.stop(); } });
window.addEventListener('blur', () => pause());
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' || e.key === 'p') { if (mode === 'playing') pause(); else if (mode === 'paused') { ui.clear(); mode = 'playing'; last = performance.now(); } }
  if (e.key === ' ' && mode === 'playing') world.activateSlowmo();
});
document.addEventListener('pointerdown', () => { unlockAudio(); ambience.setMode(mode === 'playing' ? 'game' : 'menu', world.level.time !== 'night'); }, { once: true });

// debug handle (harmless in production)
(window as unknown as { __wh: unknown }).__wh = { renderer, getWorld: () => world, getMode: () => mode, step: () => frame(performance.now()), start: (w: number, i: number) => startMission(w, i), startReal: (id: string, st: number) => startRealMission(id, st) };

world = makeDemoWorld();
addHomeButton();
// the same one-step-back button the other games have; on a menu screen the topbar arrow is the
// way back, so it only shows itself during a shift, where it holds the aircraft and opens the pause
addBackButton({ back: () => pause(), canBack: () => mode === 'playing' });
ui.title();
requestAnimationFrame(frame);
