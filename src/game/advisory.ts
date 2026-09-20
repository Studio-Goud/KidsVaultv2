import { lang } from '../i18n';
import type { Plane } from './types';
import { runwayAccepts } from './planes';
import type { World, Runway } from './world';
import { kindLabel, type Weather } from './weather';

export type Level = 0 | 1 | 2 | 3; // ok, note, warn, bad

export interface AdvisoryRow { icon: 'wind' | 'cross' | 'turb' | 'vis' | 'ice' | 'runway' | 'sea' | 'temp'; label: string; value: string; level: Level }
export interface RunwayAdvice { rw: Runway; cross: number; head: number; ok: boolean; reasons: string[]; score: number }
export interface Advisory {
  rows: AdvisoryRow[];
  runways: RunwayAdvice[];
  best: RunwayAdvice | null;
  advice: string;
  adviceLevel: Level;
  forecast: Array<{ at: number; kind: ReturnType<Weather['kind']>; kmh: number }>;
  drift: { x: number; y: number };
}

const nl = (): boolean => lang() === 'nl';
const T = (a: string, b: string): string => (nl() ? a : b);

/** Weather navigation for one aircraft: what the sky does to *this* type right now. */
export function advise(world: World, p: Plane): Advisory {
  const wx = world.weather, type = p.type, fx = world.fx;
  const rows: AdvisoryRow[] = [];
  const sample = wx.sample(p.pos);
  const sens = type.windSensitivity * fx.windFactor;

  // wind + this aircraft's drift
  const driftKmh = wx.kmhNow * sens;
  rows.push({ icon: 'wind', label: T('Wind', 'Wind'), value: `${Math.round(wx.kmhNow)} km/u${wx.cur.gust > 3 ? ` · ${T('vlagen tot', 'gusts to')} ${Math.round(wx.cur.kmh + wx.cur.gust)}` : ''}`, level: wx.kmhNow > 40 ? 2 : wx.kmhNow > 22 ? 1 : 0 });
  rows.push({ icon: 'wind', label: T('Drift dit toestel', 'Drift this aircraft'), value: `${Math.round(driftKmh)} km/u ${T('van de lijn af', 'off the line')}`, level: driftKmh > 14 ? 2 : driftKmh > 7 ? 1 : 0 });

  // turbulence vs sensitivity
  const turbLvl = sample.turb * type.windSensitivity;
  const turbWord = turbLvl < 0.15 ? T('rustig', 'smooth') : turbLvl < 0.4 ? T('licht', 'light') : turbLvl < 0.8 ? T('matig', 'moderate') : T('zwaar', 'severe');
  rows.push({ icon: 'turb', label: T('Turbulentie', 'Turbulence'), value: `${turbWord} · ${T('gevoeligheid', 'sensitivity')} ${type.windSensitivity >= 0.9 ? T('hoog', 'high') : type.windSensitivity >= 0.5 ? T('gemiddeld', 'medium') : T('laag', 'low')}`, level: turbLvl < 0.15 ? 0 : turbLvl < 0.4 ? 1 : turbLvl < 0.8 ? 2 : 3 });

  // visibility vs minima
  const vis = wx.visibility();
  const ilsOk = type.ils || fx.alignBonus > 1; // the ILS upgrade equips everyone
  const visOk = vis >= type.minVis || (ilsOk && vis >= 300);
  rows.push({ icon: 'vis', label: T('Zicht', 'Visibility'), value: `${vis} m · ${T('minima', 'minima')} ${ilsOk ? `300 m (ILS)` : `${type.minVis} m (${T('visueel', 'visual')})`}`, level: visOk ? (vis < type.minVis * 1.5 ? 1 : 0) : 3 });

  // icing
  const rate = wx.icingRate(type);
  if (wx.cur.icing > 0.05 || p.ice > 0.05) {
    const prot = type.antiIce === 'full' ? T('anti-ijs aan boord', 'anti-ice on board') : type.antiIce === 'partial' ? T('beperkte ontijzing', 'limited de-ice') : T('geen anti-ijs', 'no anti-ice');
    rows.push({ icon: 'ice', label: T('IJsafzetting', 'Icing'), value: `${p.ice > 0.05 ? `${Math.round(p.ice * 100)}% ${T('ijs', 'ice')} · ` : ''}${prot}`, level: rate > 0.015 ? 3 : rate > 0.005 ? 2 : p.ice > 0.3 ? 2 : 0 });
  }

  // runway surface / temperature
  const roll = wx.rollFactor(type);
  if (wx.cur.precip > 0.15 || wx.cur.temp > 28) {
    rows.push({ icon: 'runway', label: wx.cur.precip > 0.15 ? T('Baan nat', 'Runway wet') : T('Hitte', 'Heat'), value: `${T('uitrol', 'roll-out')} +${Math.round((roll - 1) * 100)}%`, level: roll > 1.35 ? 2 : roll > 1.1 ? 1 : 0 });
  }

  // runways for this type
  const runways: RunwayAdvice[] = world.runways.filter(rw => !rw.closed && runwayAccepts(rw.kind, type)).map(rw => {
    const c = wx.components(rw.heading);
    const reasons: string[] = [];
    let ok = true, score = 0;
    if (rw.kind !== 'helipad' && c.cross > type.crosswindLimit) { ok = false; reasons.push(T(`zijwind ${Math.round(c.cross)} > limiet ${type.crosswindLimit} km/u`, `crosswind ${Math.round(c.cross)} > limit ${type.crosswindLimit} km/h`)); }
    else if (rw.kind !== 'helipad') score += c.cross / Math.max(1, type.crosswindLimit);
    if (c.head < -18 && rw.kind !== 'helipad') { reasons.push(T(`rugwind ${Math.round(-c.head)} km/u`, `tailwind ${Math.round(-c.head)} km/h`)); score += 0.5; }
    if (!visOk) { ok = false; reasons.push(T('zicht onder minima', 'visibility below minima')); }
    if (rw.kind === 'water' && wx.seaState > type.seaLimit) { ok = false; reasons.push(T(`golven te hoog (${Math.round(wx.seaState * 100)}%)`, `waves too high (${Math.round(wx.seaState * 100)}%)`)); }
    const storm = wx.sample(rw.gate).storm;
    if (storm > 0.45) { ok = false; reasons.push(T('windschering: onweerscel boven de nadering', 'wind shear: storm cell over the approach')); }
    if (rw.occupiedBy !== null) { score += 0.3; reasons.push(T('baan bezet', 'runway occupied')); }
    return { rw, cross: c.cross, head: c.head, ok, reasons, score };
  }).sort((a, b) => Number(b.ok) - Number(a.ok) || a.score - b.score);
  const best = runways[0] ?? null;
  if (best) {
    const name = world.runwayName(best.rw);
    rows.push({ icon: 'cross', label: T(`Zijwind ${name}`, `Crosswind ${name}`), value: `${Math.round(best.cross)} km/u · ${T('limiet', 'limit')} ${type.crosswindLimit}${best.head < -8 ? ` · ${T('rugwind', 'tailwind')} ${Math.round(-best.head)}` : best.head > 8 ? ` · ${T('tegenwind', 'headwind')} ${Math.round(best.head)}` : ''}`, level: best.cross > type.crosswindLimit ? 3 : best.cross > type.crosswindLimit * 0.75 ? 2 : best.cross > type.crosswindLimit * 0.5 ? 1 : 0 });
  }
  if (type.cls === 'sea') rows.push({ icon: 'sea', label: T('Zeegang', 'Sea state'), value: `${Math.round(wx.seaState * 100)}% · ${T('limiet', 'limit')} ${Math.round(type.seaLimit * 100)}%`, level: wx.seaState > type.seaLimit ? 3 : wx.seaState > type.seaLimit * 0.7 ? 1 : 0 });

  // advice
  let advice: string, adviceLevel: Level;
  if (p.urgent) { advice = T('Voorrang: brandstof beperkt, direct naar de baan.', 'Priority: fuel limited, straight to the runway.'); adviceLevel = 3; }
  else if (!best) { advice = T('Geen geschikte baan op dit eiland.', 'No suitable runway on this island.'); adviceLevel = 3; }
  else if (best.ok) {
    advice = `${T('Land op', 'Land on')} ${world.runwayName(best.rw)}${driftKmh > 7 ? T(`, corrigeer ${Math.round(driftKmh)} km/u drift naar ${windSide(wx.dirRad)}`, `, correct ${Math.round(driftKmh)} km/h drift towards ${windSide(wx.dirRad)}`) : ''}.`;
    adviceLevel = rows.some(r => r.level >= 2) ? 1 : 0;
  } else {
    // when does it improve?
    const soon = improvesAt(world, p, best);
    advice = `${T('Nu niet landen', 'Do not land now')}: ${best.reasons[0]}. ${soon !== null ? T(`Verwachting: beter over ~${soon} s. Laat een rondje vliegen.`, `Expected to improve in ~${soon} s. Fly a holding circle.`) : T('Houd het toestel in een wachtrondje.', 'Keep the aircraft in a holding pattern.')}`;
    adviceLevel = 3;
  }

  const forecast = [0, 20, 40, 60, 90].map(dt => { const st = wx.target(world.time + dt); return { at: dt, kind: wx.kindAt(world.time + dt), kmh: Math.round(st.kmh) }; });
  return { rows, runways, best, advice, adviceLevel, forecast, drift: { x: wx.vec.x * sens, y: wx.vec.y * sens } };
}

function windSide(dirRad: number): string {
  const d = ((dirRad * 180 / Math.PI) + 90 + 360) % 360; // compass towards
  const from = (d + 180) % 360;
  const names = nl() ? ['noord', 'noordoost', 'oost', 'zuidoost', 'zuid', 'zuidwest', 'west', 'noordwest'] : ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return names[Math.round(from / 45) % 8];
}

/** Look ahead in the script for the first moment the runway becomes usable for this aircraft. */
function improvesAt(world: World, p: Plane, r: RunwayAdvice): number | null {
  const wx = world.weather, type = p.type;
  for (let dt = 10; dt <= 180; dt += 10) {
    const st = wx.target(world.time + dt);
    const rad = (st.dirDeg - 90) * Math.PI / 180;
    const wxv = { x: Math.cos(rad) * (st.kmh + st.gust * 0.5), y: Math.sin(rad) * (st.kmh + st.gust * 0.5) };
    const cross = Math.abs(-wxv.x * Math.sin(r.rw.heading) + wxv.y * Math.cos(r.rw.heading));
    const vis = 3000 - 2850 * st.fog;
    const visOk = vis >= type.minVis || ((type.ils || world.fx.alignBonus > 1) && vis >= 300);
    const seaOk = r.rw.kind !== 'water' || (st.kmh - 8) / 40 + st.precip * 0.15 <= type.seaLimit;
    if (cross <= type.crosswindLimit && visOk && seaOk && st.cells < 0.5) return dt;
  }
  return null;
}

export const weatherWord = (wx: Weather): string => kindLabel(wx.kind());
