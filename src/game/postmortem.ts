import { angleDiff, formatTime } from '../util/math';
import { lang, t } from '../i18n';
import { displayKmh } from './planes';
import type { Plane, Snapshot } from './types';
import type { World } from './world';

export interface ReportLine { t: number; text: string; bad: boolean }
export interface Report {
  title: string;
  headline: string;
  causes: string[];
  tips: string[];
  timeline: ReportLine[];
  involved: number[];
  tIncident: number;
  gap: number;
  kind: 'crash' | 'hearts';
}

function nl(): boolean { return lang() === 'nl'; }

function nameOf(world: World, id: number): string {
  const p = world.planeById(id);
  if (p) return p.type.name;
  const ev = world.events.find(e => e.kind === 'spawn' && e.planes[0] === id);
  return ev ? ev.text : `#${id}`;
}

function snapshotAt(world: World, time: number): Snapshot | undefined {
  let best: Snapshot | undefined;
  for (const s of world.snapshots) { if (s.t <= time) best = s; else break; }
  return best ?? world.snapshots[0];
}

export function buildReport(world: World): Report {
  const f = world.failure!;
  const [idA, idB] = f.planes;
  const A = world.planeById(idA), B = world.planeById(idB);
  const nameA = nameOf(world, idA), nameB = nameOf(world, idB);
  const tInc = f.t;
  const causes: string[] = [];
  const tips: string[] = [];
  const and = nl() ? 'en' : 'and';

  const lastDitch = [...world.events].reverse().find(e => e.kind === 'ditch' && Math.abs(e.t - tInc) < 0.2);
  const title = lastDitch ? (nl() ? 'Brandstof op' : 'Out of fuel') : f.kind === 'crash' ? t('collision') : (nl() ? 'Levens op' : 'Out of lives');
  const headline = lastDitch
    ? (nl() ? `${nameA} raakte zonder brandstof en moest op zee landen na ${formatTime(tInc)}. Dat kostte je laatste leven.` : `${nameA} ran out of fuel and ditched at sea at ${formatTime(tInc)}. That cost your last life.`)
    : f.kind === 'crash'
    ? (nl() ? `${nameA} ${and} ${nameB} raakten elkaar na ${formatTime(tInc)}.` : `${nameA} ${and} ${nameB} collided at ${formatTime(tInc)}.`)
    : (nl() ? `De derde bijna-botsing (${nameA} ${and} ${nameB}, ${Math.round(f.gap)} m) kostte je laatste leven na ${formatTime(tInc)}.` : `The third near miss (${nameA} ${and} ${nameB}, ${Math.round(f.gap)} m) cost your last life at ${formatTime(tInc)}.`);

  // --- geometry at the incident ---
  const snap = snapshotAt(world, tInc - 0.05);
  const sa = snap?.planes.find(p => p.id === idA), sb = snap?.planes.find(p => p.id === idB);
  const hA = sa?.h ?? A?.heading ?? 0, hB = sb?.h ?? B?.heading ?? 0;
  const rel = Math.abs(angleDiff(hA, hB));
  const typeA = A?.type, typeB = B?.type;

  const pathA = sa?.path ?? A?.path ?? [], pathB = sb?.path ?? B?.path ?? [];
  const lockA = sa?.lock ?? A?.lockedRunway ?? null, lockB = sb?.lock ?? B?.lockedRunway ?? null;

  // when were the routes drawn?
  const lastPathEvent = (id: number) => [...world.events].reverse().find(e => (e.kind === 'path' || e.kind === 'lock') && e.planes[0] === id && e.t <= tInc);
  const evA = lastPathEvent(idA), evB = lastPathEvent(idB);
  const ageA = evA ? tInc - evA.t : Infinity, ageB = evB ? tInc - evB.t : Infinity;

  const unguided: string[] = [];
  if (pathA.length === 0 && !lockA) unguided.push(nameA);
  if (pathB.length === 0 && !lockB) unguided.push(nameB);

  if (unguided.length) {
    causes.push(nl()
      ? `<strong>${unguided.join(` ${and} `)}</strong> ${unguided.length > 1 ? 'hadden' : 'had'} geen route. Zonder route vliegt een toestel rechtdoor en draait het pas om bij de rand van de kaart, dwars door alles heen.`
      : `<strong>${unguided.join(` ${and} `)}</strong> had no route. Without a route an aircraft flies straight on and only turns back at the edge of the map, straight through everything.`);
  }
  const late = [{ n: nameA, age: ageA }, { n: nameB, age: ageB }].filter(x => x.age < 3.5 && x.age !== Infinity);
  for (const l of late) {
    causes.push(nl()
      ? `Je tekende de route van <strong>${l.n}</strong> pas ${l.age.toFixed(1)} s voor het incident. Zo laat kan een toestel niet meer wegdraaien.`
      : `You drew the route for <strong>${l.n}</strong> only ${l.age.toFixed(1)} s before the incident. That late, an aircraft can no longer turn away.`);
  }
  const finals = [{ n: nameA, l: lockA }, { n: nameB, l: lockB }].filter(x => x.l);
  if (finals.length === 1) {
    const other = finals[0].n === nameA ? nameB : nameA;
    causes.push(nl()
      ? `<strong>${finals[0].n}</strong> zat al in de eindnadering. De streep vóór de baan is verboden gebied: <strong>${other}</strong> kruiste die op het verkeerde moment.`
      : `<strong>${finals[0].n}</strong> was already on final approach. The strip in front of the runway is a no-go zone: <strong>${other}</strong> crossed it at the wrong moment.`);
  } else if (finals.length === 2 && lockA === lockB) {
    const faster = (typeA?.speed ?? 0) >= (typeB?.speed ?? 0) ? nameA : nameB;
    const slower = faster === nameA ? nameB : nameA;
    const dv = Math.abs(displayKmh(typeA?.speed ?? 0) - displayKmh(typeB?.speed ?? 0));
    causes.push(nl()
      ? `Beide toestellen zaten op dezelfde nadering. <strong>${faster}</strong> vliegt ${dv} km/u sneller dan <strong>${slower}</strong> en liep in. Laat het snelle toestel eerst landen of geef het langzame een lus.`
      : `Both aircraft were on the same approach. <strong>${faster}</strong> flies ${dv} km/h faster than <strong>${slower}</strong> and caught up. Land the fast one first or give the slow one a loop.`);
  }
  if (!unguided.length && finals.length !== 2) {
    if (rel < 0.7) {
      const faster = (typeA?.speed ?? 0) >= (typeB?.speed ?? 0) ? nameA : nameB;
      causes.push(nl()
        ? `De routes liepen naast elkaar in dezelfde richting. <strong>${faster}</strong> is sneller en haalde de ander in; twee routes op dezelfde koers hebben minstens 60 m tussenruimte nodig.`
        : `The routes ran side by side in the same direction. <strong>${faster}</strong> is faster and overtook the other; two routes on the same course need at least 60 m of spacing.`);
    } else if (rel > 2.4) {
      causes.push(nl()
        ? `De routes liepen <strong>frontaal</strong> tegen elkaar in. Twee toestellen die op elkaar afvliegen sluiten twee keer zo snel: de cirkels raken elkaar voor je het ziet.`
        : `The routes ran <strong>head-on</strong>. Two aircraft flying towards each other close twice as fast: the rings touch before you see it.`);
    } else {
      causes.push(nl()
        ? `De routes <strong>kruisten</strong> elkaar op hetzelfde moment. Kijk naar de cirkels: laat de een passeren en geef de ander een boog of een lus.`
        : `The routes <strong>crossed</strong> at the same moment. Watch the rings: let one pass and give the other a curve or a loop.`);
    }
  }
  // wind
  const crossA = sa?.cross ?? 0, crossB = sb?.cross ?? 0;
  if (world.level.wind && world.wind.kmh > 10 && Math.max(crossA, crossB) > 14) {
    const who = crossA > crossB ? nameA : nameB;
    causes.push(nl()
      ? `De wind (${Math.round(world.wind.kmh)} km/u) duwde <strong>${who}</strong> ${Math.round(Math.max(crossA, crossB))} m van de getekende lijn af. Bij wind is een route geen garantie: houd extra marge aan de lijzijde.`
      : `The wind (${Math.round(world.wind.kmh)} km/h) pushed <strong>${who}</strong> ${Math.round(Math.max(crossA, crossB))} m off the drawn line. In wind a route is no guarantee: keep extra margin on the downwind side.`);
  }
  const ditched = world.events.filter(e => e.kind === 'ditch');
  if (ditched.length) {
    causes.push(nl()
      ? `<strong>${ditched.map(d => d.text.split(':')[0]).join(', ')}</strong> kwam zonder brandstof te zitten. Militaire toestellen met een brandstoftimer hebben voorrang: land ze meteen, ook als je daarvoor een ander toestel een rondje moet laten vliegen.`
      : `<strong>${ditched.map(d => d.text.split(':')[0]).join(', ')}</strong> ran out of fuel. Military aircraft with a fuel timer have priority: land them immediately, even if another aircraft has to fly a circle for it.`);
  }
  if (f.kind === 'hearts') {
    const misses = world.events.filter(e => e.kind === 'nearmiss');
    causes.push(nl()
      ? `Eerdere bijna-botsingen: ${misses.slice(0, -1).map(m => `${m.text.replace(t('nearMiss') + ': ', '')} (${formatTime(m.t)})`).join('; ')}.`
      : `Earlier near misses: ${misses.slice(0, -1).map(m => `${m.text.replace(t('nearMiss') + ': ', '')} (${formatTime(m.t)})`).join('; ')}.`);
  }

  // --- tips ---
  const seen = new Set<string>();
  for (const p of [A, B]) {
    if (!p || seen.has(p.type.id)) continue;
    seen.add(p.type.id);
    tips.push(nl() ? p.type.tip : p.type.tipEn);
  }
  const goArounds = world.events.filter(e => e.kind === 'goaround').length;
  if (goArounds > 0) tips.push(nl()
    ? `Je had ${goArounds} doorstart${goArounds > 1 ? 's' : ''}. Een doorstart gooit een toestel zonder route terug de lucht in: geef het meteen een nieuwe route.`
    : `You had ${goArounds} go-around${goArounds > 1 ? 's' : ''}. A go-around throws an aircraft back into the air without a route: give it a new one immediately.`);
  tips.push(nl()
    ? 'Tik op een toestel om te zien hoe snel het is en waar het mag landen.'
    : 'Tap an aircraft to see its speed and where it may land.');

  // --- timeline ---
  const timeline: ReportLine[] = world.events
    .filter(e => e.t >= tInc - 25 && e.kind !== 'spawn')
    .map(e => ({ t: e.t, text: e.text, bad: e.kind === 'nearmiss' || e.kind === 'crash' || e.kind === 'goaround' || e.kind === 'ditch' || e.kind === 'mayday' }));

  return { title, headline, causes, tips, timeline, involved: [idA, idB], tIncident: tInc, gap: f.gap, kind: f.kind };
}

export function interpolate(world: World, time: number): Array<{ id: number; x: number; y: number; h: number; alt: number; state: Plane['state']; path: Snapshot['planes'][number]['path']; lock: string | null }> {
  const snaps = world.snapshots;
  if (!snaps.length) return [];
  let i = 0;
  while (i < snaps.length - 1 && snaps[i + 1].t <= time) i++;
  const a = snaps[i], b = snaps[Math.min(i + 1, snaps.length - 1)];
  const k = b.t === a.t ? 0 : Math.max(0, Math.min(1, (time - a.t) / (b.t - a.t)));
  return a.planes.map(pa => {
    const pb = b.planes.find(p => p.id === pa.id) ?? pa;
    const dh = angleDiff(pa.h, pb.h);
    return { id: pa.id, x: pa.x + (pb.x - pa.x) * k, y: pa.y + (pb.y - pa.y) * k, h: pa.h + dh * k, alt: pa.alt + (pb.alt - pa.alt) * k, state: pa.state, path: pa.path, lock: pa.lock };
  });
}
