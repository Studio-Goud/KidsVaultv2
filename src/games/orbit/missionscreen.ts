/**
 * The Missions tab of Planetarium: mission control, on a phone.
 *
 * Pick a mission, drag from Earth to set the push, watch the dotted line bend round the sun and the
 * ring that says where the target will be, then launch and hope. Later missions shorten the line
 * until you are leading the target by eye, which is the skill the whole thing is for.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { audioContext } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import { drawBody } from './draw';
import { byId as bodyData } from './bodies';
import {
  advance, bodiesFor, bodyById, bodyPos, fate, launch, launchPoint, MISSIONS, predict, starsFor,
  type Fate, type Mission, type Probe,
} from './missions';

type Ctx = CanvasRenderingContext2D;
type Stage = 'pick' | 'aim' | 'fly' | 'burn' | 'done';

const NL = (): boolean => (navigator.language || 'en').toLowerCase().startsWith('nl');
const T = (en: string, nl: string): string => (NL() ? nl : en);
const nameOf = (m: Mission): string => (NL() ? m.nameNl : m.name);
const saveKey = (m: Mission): string => `orbitm:${m.id}`;

export interface Hit { id: string; x: number; y: number; w: number; h: number }

// ---------- a few sounds of mission control ----------
const on = (): boolean => save.sound !== false;
function ping(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', to?: number, when = 0): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
function rumble(dur: number, gain: number): void {
  const ctx = audioContext();
  if (!ctx || !on()) return;
  const n = Math.floor(ctx.sampleRate * dur);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.05 * w) / 1.05; d[i] = last * 4; }
  const src = ctx.createBufferSource(); src.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220;
  const g = ctx.createGain(); const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
}
const snd = {
  count(i: number): void { ping(i === 0 ? 1320 : 880, 0.12, 0.05, 'square'); },
  launch(): void { rumble(2.2, 0.16); ping(90, 1.6, 0.05, 'sawtooth', 40); },
  burn(): void { rumble(0.6, 0.08); },
  arrive(): void { [659, 880, 1175, 1568].forEach((f, i) => ping(f, 0.35, 0.05, 'triangle', undefined, i * 0.11)); },
  lost(): void { ping(300, 1.2, 0.05, 'sine', 60); },
  tap(): void { ping(740, 0.06, 0.05, 'sine'); },
  tick(): void { ping(1760, 0.04, 0.02, 'sine'); },
};

export class MissionScreen {
  private stage: Stage = 'pick';
  private mission: Mission = MISSIONS[0];
  private index = 0;
  /** mission time */
  private t = 0;
  private probe: Probe | null = null;
  private fuel = 0;
  private burnsLeft = 0;
  private target = '';
  private legs = 0;
  private dv: Vec = { x: 0, y: 0 };
  private dragging = false;
  private dragFrom: Vec = { x: 0, y: 0 };
  private result: Fate | 'timeout' | null = null;
  private earned = 0;
  private countdown = 0;
  private lastTick = 0;
  private message = '';
  private messageT = 0;
  private hits: Hit[] = [];
  private map = { cx: 0, cy: 0, scale: 100 };

  constructor(private font: (weight: string, size: number) => string) {}

  // ---------- lifecycle ----------

  private unlocked(i: number): boolean { return i === 0 || levelProgress(saveKey(MISSIONS[i - 1])).completed; }

  private start(i: number): void {
    this.index = clamp(i, 0, MISSIONS.length - 1);
    this.mission = MISSIONS[this.index];
    this.t = 0;
    this.probe = null;
    this.fuel = this.mission.fuel;
    this.burnsLeft = this.mission.burns;
    this.target = this.mission.to;
    this.legs = 0;
    this.dv = { x: 0, y: 0 };
    this.result = null;
    this.earned = 0;
    this.countdown = 0;
    this.stage = 'aim';
    this.say(NL() ? this.mission.hintNl : this.mission.hint, 7);
  }

  private say(text: string, secs = 3): void { this.message = text; this.messageT = secs; }

  private fromBodyId(): string { return this.legs === 0 ? this.mission.from : this.mission.to; }

  update(dt: number): void {
    this.messageT = Math.max(0, this.messageT - dt);
    if (this.stage === 'aim' || this.stage === 'pick' || this.stage === 'done') {
      // The world keeps turning while you think - waiting for the right moment is half of it.
      // But the moment a push is actually set, everything holds still until you fire it or let
      // it go. Otherwise the shot the dotted line promised is not the shot the button sends:
      // the launch point creeps on while a child reaches for Launch.
      const aiming = this.stage === 'aim' && Math.hypot(this.dv.x, this.dv.y) > 0.005;
      if (this.stage !== 'pick' && !aiming) this.t += dt * this.aimRate();
      return;
    }
    if (this.countdown > 0) {
      this.countdown -= dt;
      const c = Math.ceil(this.countdown);
      if (c !== this.lastTick) { this.lastTick = c; snd.count(c); }
      if (this.countdown <= 0) { this.stage = 'fly'; snd.launch(); }
      return;
    }
    if (this.stage === 'burn') { this.t += dt * this.mission.speed * 0.15; if (this.probe) advance(this.probe, dt * this.mission.speed * 0.15, true); return; }
    if (!this.probe) return;
    const mt = dt * this.mission.speed;
    this.t += mt;
    advance(this.probe, mt, true);
    const f = fate(this.mission, this.probe, this.target, this.t);
    if (f === 'arrived') {
      if (this.mission.then && this.legs === 0) {
        // refuel at the first stop and go again
        this.legs = 1;
        this.target = this.mission.then;
        this.fuel = Math.min(this.mission.fuel, this.fuel + this.mission.fuel * 0.6);
        this.probe = null;
        this.dv = { x: 0, y: 0 };
        this.stage = 'aim';
        snd.arrive();
        this.say(T('Refuelled. Now on to ' + bodyData(this.target).name + '.', 'Bijgetankt. Nu door naar ' + bodyData(this.target).nameNl + '.'), 5);
        return;
      }
      this.finish('arrived');
    } else if (f === 'sun' || f === 'lost') this.finish(f);
    else if (this.t > this.mission.limit) this.finish('timeout');
  }

  private finish(f: Fate | 'timeout'): void {
    this.result = f;
    this.stage = 'done';
    if (f === 'arrived') {
      this.earned = starsFor(this.mission, this.fuel, this.probe?.flight ?? 0);
      recordLevelResult(saveKey(this.mission), 1, this.earned, true);
      save.coins = Math.max(0, Math.round(save.coins + 30 + this.earned * 20)); persist();
      snd.arrive();
    } else snd.lost();
  }

  // ---------- input ----------

  /** Returns true when the tap was ours. */
  onDown(p: Vec, hit: string | null): boolean {
    if (hit) {
      if (hit.startsWith('mission:')) { const i = Number(hit.slice(8)); if (this.unlocked(i)) { this.start(i); snd.tap(); } else snd.lost(); return true; }
      if (hit === 'missions') { this.stage = 'pick'; snd.tap(); return true; }
      if (hit === 'retry') { this.start(this.index); return true; }
      if (hit === 'next') { this.start(Math.min(MISSIONS.length - 1, this.index + 1)); return true; }
      if (hit === 'launch') {
        if (this.stage === 'aim' && Math.hypot(this.dv.x, this.dv.y) > 0.01) {
          this.probe = launch(this.mission, this.fromBodyId(), this.t, this.dv.x, this.dv.y, this.fuel);
          this.fuel = this.probe.fuel;
          this.countdown = 3; this.lastTick = 4;
          this.stage = 'fly';
        }
        return true;
      }
      if (hit === 'probe' && this.stage === 'fly' && this.burnsLeft > 0 && this.countdown <= 0) {
        this.stage = 'burn'; this.dv = { x: 0, y: 0 }; this.dragging = true; this.dragFrom = p;
        this.say(T('Drag to nudge the probe. Let go to burn.', 'Sleep om de sonde een zetje te geven. Laat los om te branden.'), 3);
        return true;
      }
      return false;
    }
    if (this.stage === 'aim') { this.dragging = true; this.dragFrom = p; this.setDv(p); return true; }
    return this.stage !== 'pick';
  }

  onMove(p: Vec): void {
    if (!this.dragging) return;
    if (this.stage === 'aim' || this.stage === 'burn') this.setDv(p);
  }

  onUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.stage === 'burn' && this.probe) {
      const cost = Math.hypot(this.dv.x, this.dv.y);
      if (cost > 0.005) {
        this.probe.vx += this.dv.x; this.probe.vy += this.dv.y;
        this.fuel = Math.max(0, this.fuel - cost);
        this.burnsLeft--;
        snd.burn();
      }
      this.dv = { x: 0, y: 0 };
      this.stage = 'fly';
    }
  }

  /**
   * How fast the clock runs while you are aiming.
   *
   * The probe waits on a circle round the body it leaves, and that circle turns. Round the Earth
   * it turns fast: on the Moon mission it came all the way round about once a second, so by the
   * time a child had let go of the drag the launch point was somewhere else entirely and the shot
   * they had just lined up was not the shot they fired. Now the clock is slowed until that circle
   * turns no more than half a radian a second, which is slow enough to aim at and to watch. The
   * target still creeps, so leading it is still the whole job.
   */
  private aimRate(): number {
    const b = bodyById(this.mission, this.fromBodyId());
    const r0 = b.r === 0 ? b.size * 1.4 : b.r;
    const w = Math.pow(r0, -1.5);
    return Math.min(this.mission.speed * 0.35, 0.5 / w);
  }

  /** How far you drag for a push at full strength: a thumb's sweep, not twenty pixels. */
  private dragSpan = 120;

  /** What the dotted line last worked out, so a test can read what a child would see. */
  private lastPred: ReturnType<typeof predict> | null = null;


  /** The strength of the push you may set at this moment. */
  private dvCap(): number { return this.stage === 'burn' ? Math.min(this.fuel, 0.35) : this.fuel; }

  /**
   * The drag becomes a push. It is measured in pixels on the glass rather than in map units,
   * because the map is squeezed differently for every mission: at the old fixed rate the whole
   * range of the fuel fitted inside a circle the width of a fingertip, and a tremble threw the
   * probe across the solar system.
   */
  private setDv(p: Vec): void {
    const dx = p.x - this.dragFrom.x, dy = p.y - this.dragFrom.y;
    const reach = Math.max(40, this.dragSpan);
    const cap = this.dvCap();
    const mag = Math.hypot(dx, dy);
    const k = cap / reach;
    let vx = dx * k, vy = dy * k;
    if (mag > reach) { vx *= reach / mag; vy *= reach / mag; }
    this.dv = { x: vx, y: vy };
  }

  // ---------- drawing ----------

  private layoutMap(w: number, h: number, u: number): void {
    const outer = Math.max(...bodiesFor(this.mission).map(b => b.r)) + 0.45;
    const top = 100 * u, bottom = h - 150 * u;
    const size = Math.min(w - 20 * u, bottom - top);
    this.map = { cx: w / 2, cy: top + (bottom - top) / 2, scale: (size / 2) / outer };
    this.dragSpan = Math.min(w, h) * 0.3;
  }

  private toScreen(p: { x: number; y: number }): Vec { return { x: this.map.cx + p.x * this.map.scale, y: this.map.cy + p.y * this.map.scale }; }

  draw(ctx: Ctx, w: number, h: number, u: number, dpr: number, now: number): Hit[] {
    this.hits = [];
    if (this.stage === 'pick') { this.drawPick(ctx, w, h, u); return this.hits; }
    this.layoutMap(w, h, u);
    const m = this.mission;
    const bodies = bodiesFor(m);

    // orbits
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1;
    for (const b of bodies) if (b.r > 0) { ctx.beginPath(); ctx.arc(this.map.cx, this.map.cy, b.r * this.map.scale, 0, TAU); ctx.stroke(); }

    // the centre: the sun, or Earth for the Moon mission
    if (m.system === 'sun') {
      const g = ctx.createRadialGradient(this.map.cx, this.map.cy, 2, this.map.cx, this.map.cy, 0.16 * this.map.scale);
      g.addColorStop(0, '#fff4c4'); g.addColorStop(0.5, '#ffd86b'); g.addColorStop(1, 'rgba(240,147,42,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.map.cx, this.map.cy, 0.16 * this.map.scale, 0, TAU); ctx.fill();
    }

    // prediction while aiming or burning
    const from = this.fromBodyId();
    const probeForPredict = this.stage === 'aim'
      ? (Math.hypot(this.dv.x, this.dv.y) > 0.005 ? launch(m, from, this.t, this.dv.x, this.dv.y, this.fuel) : null)
      : this.stage === 'burn' && this.probe ? { ...this.probe, vx: this.probe.vx + this.dv.x, vy: this.probe.vy + this.dv.y, trail: [] } : null;
    let pred = null;
    if (probeForPredict) {
      pred = predict(m, probeForPredict, this.target, this.t, m.predict);
      ctx.setLineDash([3 * u, 6 * u]);
      ctx.strokeStyle = pred.arrives ? 'rgba(157,247,196,0.9)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      pred.points.forEach((q, i) => { const s = this.toScreen(q); if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y); });
      ctx.stroke();
      ctx.setLineDash([]);
      if (pred.ghost) {
        const g = this.toScreen(pred.ghost);
        const tb = bodyById(m, this.target);
        ctx.strokeStyle = pred.arrives ? '#9df7c4' : 'rgba(255,226,122,0.8)'; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.arc(g.x, g.y, Math.max(8 * u, tb.capture * this.map.scale), 0, TAU); ctx.stroke();
      }
    }

    // trail
    if (this.probe && this.probe.trail.length > 1) {
      ctx.strokeStyle = 'rgba(255,226,122,0.55)'; ctx.lineWidth = 1.5 * u;
      ctx.beginPath();
      this.probe.trail.forEach((q, i) => { const s = this.toScreen(q); if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y); });
      ctx.stroke();
    }

    // planets, as their photographs
    for (const b of bodies) {
      const p = this.toScreen(bodyPos(b, this.t));
      const r = Math.max(4 * u, b.size * this.map.scale * (m.system === 'earth' ? 1 : 1.6));
      const data = bodyData(b.id === 'moon' ? 'earth' : b.id);
      if (b.id === 'moon') { ctx.fillStyle = '#c9c4bd'; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill(); }
      else drawBody(ctx, data, p.x, p.y, r, dpr);
      if (b.id === this.target) {
        ctx.strokeStyle = 'rgba(157,247,196,0.7)'; ctx.lineWidth = 1.5 * u;
        ctx.setLineDash([2 * u, 4 * u]);
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 8 * u + Math.sin(now * 3) * 2 * u, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // the push arrow while aiming
    if (this.stage === 'aim' || this.stage === 'burn') {
      const origin = this.stage === 'aim' ? this.toScreen(launchPoint(m, from, this.t)) : this.toScreen(this.probe!);
      const len = Math.hypot(this.dv.x, this.dv.y) / Math.max(0.001, this.dvCap()) * this.dragSpan;
      if (len > 2) {
        const a = Math.atan2(this.dv.y, this.dv.x);
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3 * u; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(origin.x + Math.cos(a) * len, origin.y + Math.sin(a) * len); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(origin.x + Math.cos(a) * len, origin.y + Math.sin(a) * len);
        ctx.lineTo(origin.x + Math.cos(a + 2.6) * 9 * u + Math.cos(a) * len, origin.y + Math.sin(a + 2.6) * 9 * u + Math.sin(a) * len);
        ctx.moveTo(origin.x + Math.cos(a) * len, origin.y + Math.sin(a) * len);
        ctx.lineTo(origin.x + Math.cos(a - 2.6) * 9 * u + Math.cos(a) * len, origin.y + Math.sin(a - 2.6) * 9 * u + Math.sin(a) * len);
        ctx.stroke();
      }
    }

    // the probe
    if (this.probe) {
      const s = this.toScreen(this.probe);
      const a = Math.atan2(this.probe.vy, this.probe.vx);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
      ctx.fillStyle = '#eaf2ff';
      ctx.beginPath(); ctx.moveTo(7 * u, 0); ctx.lineTo(-5 * u, -4 * u); ctx.lineTo(-3 * u, 0); ctx.lineTo(-5 * u, 4 * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3f86d6'; ctx.fillRect(-2 * u, -9 * u, 3 * u, 18 * u);
      ctx.restore();
      if (this.stage === 'fly' && this.burnsLeft > 0 && this.countdown <= 0) {
        ctx.strokeStyle = 'rgba(255,226,122,0.6)'; ctx.lineWidth = 1.5 * u;
        ctx.beginPath(); ctx.arc(s.x, s.y, 16 * u, 0, TAU); ctx.stroke();
      }
      this.hits.push({ id: 'probe', x: s.x - 22 * u, y: s.y - 22 * u, w: 44 * u, h: 44 * u });
    }

    this.lastPred = pred;
    this.drawHud(ctx, w, h, u, pred);
    if (this.stage === 'done') this.drawDone(ctx, w, h, u);
    return this.hits;
  }

  private button(ctx: Ctx, id: string, label: string, cx: number, cy: number, bw: number, bh: number, strong: boolean, u: number): void {
    const x = cx - bw / 2, y = cy - bh / 2;
    ctx.fillStyle = strong ? 'rgba(157,247,196,0.92)' : 'rgba(255,255,255,0.12)';
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, bh / 2); ctx.fill();
    if (!strong) { ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.fillStyle = strong ? '#0b2a1c' : '#eaf2ff'; ctx.font = this.font('800', bh > 40 * u ? 15 : 12);
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + bh * 0.16, bw - 16);
    this.hits.push({ id, x, y, w: bw, h: bh });
  }

  private drawHud(ctx: Ctx, w: number, h: number, u: number, pred: ReturnType<typeof predict> | null): void {
    const m = this.mission;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf2ff'; ctx.font = this.font('900', 17);
    ctx.fillText(nameOf(m), w / 2, 62 * u, w - 200 * u);

    // fuel
    const bw = Math.min(160 * u, w * 0.4), bh = 8 * u, bx = w / 2 - bw / 2, by = 76 * u;
    ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.roundRect(bx, by, Math.max(bh, bw * clamp(this.fuel / m.fuel, 0, 1)), bh, bh / 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,216,244,0.7)'; ctx.font = this.font('800', 9);
    ctx.fillText(`${T('fuel', 'brandstof')} ${Math.round(this.fuel / m.fuel * 100)}%${m.burns ? ' · ' + this.burnsLeft + ' ' + T('burns', 'correcties') : ''}`, w / 2, by + bh + 12 * u);

    // the readout under the map
    const ry = h - 128 * u;
    if (this.stage === 'aim') {
      if (pred) {
        const tb = bodyById(m, this.target);
        const text = pred.arrives
          ? T('On course. Arrives in ' + pred.when.toFixed(1) + ' s.', 'Op koers. Aankomst over ' + pred.when.toFixed(1) + ' s.')
          : T('Misses by ' + Math.round(pred.closest / tb.capture * 100) / 100 + ' × the catch zone', 'Mist met ' + Math.round(pred.closest / tb.capture * 100) / 100 + ' × de vangzone');
        ctx.fillStyle = pred.arrives ? '#9df7c4' : 'rgba(255,226,122,0.9)'; ctx.font = this.font('800', 12);
        ctx.fillText(text, w / 2, ry, w - 40 * u);
        this.button(ctx, 'launch', T('Launch', 'Lanceren'), w / 2, h - 96 * u, 170 * u, 46 * u, pred.arrives, u);
      } else {
        ctx.fillStyle = 'rgba(200,216,244,0.7)'; ctx.font = this.font('700', 12);
        ctx.fillText(T('Drag anywhere to set the push.', 'Sleep ergens om de duw in te stellen.'), w / 2, ry, w - 40 * u);
      }
    } else if (this.stage === 'fly' && this.countdown > 0) {
      ctx.fillStyle = '#ffe27a'; ctx.font = this.font('900', 40);
      ctx.fillText(String(Math.ceil(this.countdown)), w / 2, h - 96 * u);
    } else if (this.stage === 'fly' || this.stage === 'burn') {
      ctx.fillStyle = 'rgba(200,216,244,0.75)'; ctx.font = this.font('800', 12);
      ctx.fillText(`${T('flight', 'vlucht')} ${this.t.toFixed(0)} s · ${T('limit', 'limiet')} ${m.limit} s`, w / 2, ry, w - 40 * u);
    }

    if (this.messageT > 0 && this.stage !== 'done') {
      ctx.globalAlpha = clamp(this.messageT, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.font = this.font('700', 11);
      const lines = wrap(ctx, this.message, w - 60 * u);
      const boxH = lines.length * 15 * u + 14 * u;
      ctx.beginPath(); ctx.roundRect(16 * u, 96 * u, w - 32 * u, boxH, 11 * u); ctx.fill();
      ctx.fillStyle = '#eaf2ff';
      lines.forEach((ln, i) => ctx.fillText(ln, w / 2, 96 * u + 17 * u + i * 15 * u));
      ctx.globalAlpha = 1;
    }
    this.button(ctx, 'missions', T('Missions', 'Missies'), 12 * u + 44 * u, 12 * u + 15 * u, 88 * u, 30 * u, false, u);
    ctx.textAlign = 'left';
  }

  private drawDone(ctx: Ctx, w: number, h: number, u: number): void {
    ctx.fillStyle = 'rgba(5,8,28,0.6)'; ctx.fillRect(0, 0, w, h);
    const cw = Math.min(340 * u, w - 32 * u), ch = 240 * u;
    const x = w / 2 - cw / 2, y = h / 2 - ch / 2;
    ctx.fillStyle = 'rgba(20,28,74,0.96)';
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 22 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.textAlign = 'center';
    const r = this.result;
    ctx.fillStyle = '#eaf2ff'; ctx.font = this.font('900', 22);
    ctx.fillText(
      r === 'arrived' ? T('Orbit achieved', 'In een baan') : r === 'sun' ? T('Into the sun', 'In de zon') : r === 'lost' ? T('Lost to deep space', 'Verloren in de ruimte') : T('Out of time', 'Tijd om'),
      w / 2, y + 44 * u);
    ctx.fillStyle = 'rgba(200,216,244,0.75)'; ctx.font = this.font('700', 12.5);
    if (r === 'arrived') {
      ctx.fillText(`${T('fuel left', 'brandstof over')} ${Math.round(this.fuel / this.mission.fuel * 100)}% · ${T('flight', 'vlucht')} ${(this.probe?.flight ?? 0).toFixed(0)} s`, w / 2, y + 70 * u, cw - 30 * u);
      for (let i = 0; i < 3; i++) star(ctx, w / 2 + (i - 1) * 30 * u, y + 108 * u, 12 * u, i < this.earned ? '#e8b437' : 'rgba(255,255,255,0.18)');
    } else {
      const why = r === 'sun' ? T('Too slow: you fell all the way in.', 'Te langzaam: je viel helemaal naar binnen.')
        : r === 'lost' ? T('Too fast: you never came back.', 'Te snel: je kwam nooit meer terug.')
          : T('The orbit never crossed the target.', 'De baan kruiste het doel nooit.');
      ctx.fillText(why, w / 2, y + 72 * u, cw - 30 * u);
      ctx.fillText(NL() ? this.mission.hintNl : this.mission.hint, w / 2, y + 100 * u, cw - 30 * u);
    }
    const bw = 130 * u, bh = 44 * u;
    this.button(ctx, 'retry', T('Again', 'Opnieuw'), w / 2 - bw / 2 - 6 * u, y + ch - 66 * u, bw, bh, false, u);
    if (r === 'arrived' && this.index + 1 < MISSIONS.length) this.button(ctx, 'next', T('Next mission', 'Volgende missie'), w / 2 + bw / 2 + 6 * u, y + ch - 66 * u, bw, bh, true, u);
    else this.button(ctx, 'missions', T('All missions', 'Alle missies'), w / 2 + bw / 2 + 6 * u, y + ch - 66 * u, bw, bh, true, u);
  }

  private drawPick(ctx: Ctx, w: number, h: number, u: number): void {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#eaf2ff'; ctx.font = this.font('900', 22);
    ctx.fillText(T('Missions', 'Missies'), w / 2, 62 * u);
    ctx.fillStyle = 'rgba(214,228,255,0.68)'; ctx.font = this.font('700', 12);
    ctx.fillText(T('Aim where the planet will be, not where it is.', 'Richt waar de planeet zal zijn, niet waar hij is.'), w / 2, 84 * u, w - 30 * u);
    const cols = w > 700 * u ? 4 : 2;
    const cw = Math.min(170 * u, (w - 32 * u - (cols - 1) * 12 * u) / cols), chh = 92 * u;
    const total = cols * cw + (cols - 1) * 12 * u;
    const x0 = (w - total) / 2;
    MISSIONS.forEach((m, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + 12 * u), y = 108 * u + row * (chh + 12 * u);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(m));
      ctx.fillStyle = open ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
      ctx.beginPath(); ctx.roundRect(x, y, cw, chh, 16 * u); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = open ? 'rgba(200,216,244,0.6)' : 'rgba(200,216,244,0.3)'; ctx.font = this.font('800', 10);
      ctx.fillText(`${i + 1}`, x + 12 * u, y + 20 * u);
      ctx.fillStyle = open ? '#eaf2ff' : 'rgba(234,242,255,0.4)'; ctx.font = this.font('900', 13);
      ctx.fillText(nameOf(m), x + 12 * u, y + 40 * u, cw - 24 * u);
      ctx.fillStyle = 'rgba(200,216,244,0.6)'; ctx.font = this.font('700', 9.5);
      ctx.fillText(`${T('fuel', 'brandstof')} ${m.fuel} · ${m.predict < 10 ? T('short line', 'korte lijn') : T('full line', 'volle lijn')}`, x + 12 * u, y + 58 * u, cw - 24 * u);
      for (let s = 0; s < 3; s++) star(ctx, x + 18 * u + s * 16 * u, y + 76 * u, 5.5 * u, s < p.stars ? '#e8b437' : 'rgba(255,255,255,0.18)');
      if (!open) { ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(200,216,244,0.45)'; ctx.font = this.font('800', 9); ctx.fillText(T('finish the one before', 'eerst de vorige'), x + cw - 12 * u, y + 79 * u); }
      this.hits.push({ id: `mission:${i}`, x, y, w: cw, h: chh });
    });
    ctx.textAlign = 'left';
  }

  debugState(): Record<string, unknown> {
    return {
      stage: this.stage, mission: this.mission.id, t: Math.round(this.t * 10) / 10, fuel: Math.round(this.fuel * 100) / 100,
      target: this.target, legs: this.legs, result: this.result, stars: this.earned, dv: this.dv, map: this.map,
      dragSpan: this.dragSpan,
      arrives: this.lastPred ? this.lastPred.arrives : null,
      closest: this.lastPred ? Math.round(this.lastPred.closest * 1000) / 1000 : null,
      when: this.lastPred ? Math.round(this.lastPred.when * 10) / 10 : null,
      probe: this.probe ? { x: this.probe.x, y: this.probe.y, flight: Math.round(this.probe.flight) } : null,
      buttons: this.hits.map(h => ({ id: h.id, x: Math.round(h.x + h.w / 2), y: Math.round(h.y + h.h / 2) })),
    };
  }
}

function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function star(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}
