import { save } from './storage';
import { withSamples } from '../platform/samples';

/**
 * All sound is synthesized with WebAudio: no audio files, works offline inside Capacitor.
 * - Sfx: one-shot effects
 * - Ambience: sea, wind, gulls and a soft music bed
 * - EngineMixer: a continuous engine voice per aircraft
 * - Radio: ATC phrases through speech synthesis with a squelch click
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

export function audioContext(): AudioContext | null { return ctx; }

export function unlockAudio(): void {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    // shared 2 s noise buffer
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < d.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046; b1 = 0.963 * b1 + white * 0.2965164; b2 = 0.57 * b2 + white * 1.0526913;
      d[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12; // pink-ish
    }
  } catch { ctx = null; }
}

function noiseSource(): AudioBufferSourceNode | null {
  if (!ctx || !noiseBuffer) return null;
  const s = ctx.createBufferSource(); s.buffer = noiseBuffer; s.loop = true; return s;
}

const enabled = (): boolean => !!ctx && !!master && save.sound;

function tone(freq: number, t0: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, dest?: AudioNode): void {
  if (!ctx || !master) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest ?? master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

function noiseBurst(t0: number, dur: number, gain: number, filterType: BiquadFilterType, freq: number, q = 1, slideTo?: number): void {
  if (!ctx || !master) return;
  const s = noiseSource(); if (!s) return;
  const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
  if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(master); s.start(t0); s.stop(t0 + dur + 0.1);
}

export const sfx = withSamples('cloudhopper', {
  unlock: unlockAudio,
  landed(): void {
    if (!enabled() || !ctx) return;
    const t = ctx.currentTime;
    tone(659, t, 0.35, 'sine', 0.22); tone(988, t + 0.12, 0.45, 'sine', 0.2); tone(1319, t + 0.24, 0.6, 'sine', 0.16);
  },
  touchdown(heavy: boolean): void {
    if (!enabled() || !ctx) return;
    const t = ctx.currentTime;
    // tyre chirp + thump, then reverse thrust roar for jets
    noiseBurst(t, 0.18, 0.25, 'bandpass', 2400, 6, 1400);
    tone(90, t, 0.25, 'sine', 0.3, 40);
    if (heavy) noiseBurst(t + 0.4, 2.2, 0.35, 'lowpass', 900, 0.7, 300);
  },
  pathStart(): void { if (enabled() && ctx) tone(520, ctx.currentTime, 0.08, 'triangle', 0.07, 700); },
  pathLock(): void {
    if (!enabled() || !ctx) return;
    const t = ctx.currentTime; tone(880, t, 0.12, 'triangle', 0.1); tone(1175, t + 0.08, 0.18, 'triangle', 0.1);
  },
  warn(): void {
    if (!enabled() || !ctx) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) tone(1046, t + i * 0.16, 0.1, 'square', 0.05);
  },
  goAround(): void { if (enabled() && ctx) tone(300, ctx.currentTime, 0.4, 'sawtooth', 0.05, 520); },
  crash(): void {
    if (!enabled() || !ctx || !master) return;
    const t = ctx.currentTime;
    tone(120, t, 0.9, 'sawtooth', 0.22, 35);
    noiseBurst(t, 1.4, 0.45, 'lowpass', 1800, 0.5, 200);
    noiseBurst(t + 0.05, 0.3, 0.5, 'highpass', 3000, 0.5);
  },
  tap(): void { if (enabled() && ctx) tone(740, ctx.currentTime, 0.06, 'sine', 0.07); },
  coin(i = 0): void { if (enabled() && ctx) { const t = ctx.currentTime + i * 0.06; tone(1568, t, 0.12, 'square', 0.04); tone(2093, t + 0.05, 0.16, 'square', 0.04); } },
  fanfare(): void {
    if (!enabled() || !ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.1, 0.55, 'sine', 0.18));
    [262, 330, 392].forEach((f) => tone(f, t, 1.2, 'triangle', 0.08));
  },
  squelch(open: boolean): void {
    if (!enabled() || !ctx) return;
    const t = ctx.currentTime;
    noiseBurst(t, open ? 0.09 : 0.06, 0.12, 'bandpass', 1800, 2);
    if (!open) tone(1200, t + 0.03, 0.04, 'square', 0.03);
  },
  slowmo(on: boolean): void {
    if (!enabled() || !ctx) return;
    const t = ctx.currentTime;
    tone(on ? 880 : 440, t, 0.5, 'sine', 0.12, on ? 220 : 880);
  },
});

export function haptic(kind: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (!save.haptics) return;
  try {
    const pattern: number | number[] = kind === 'light' ? 10 : kind === 'medium' ? 25 : [30, 40, 60];
    if (typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch { /* unsupported */ }
}

// ---------------- ambience & music ----------------

export class Ambience {
  private built = false;
  private seaGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private musicGain: GainNode | null = null;
  private rainGain: GainNode | null = null;
  private gullTimer = 0;
  private musicTimer = 0;
  private chord = 0;
  private mode: 'menu' | 'game' | 'off' = 'off';
  private day = true;

  private build(): void {
    if (this.built || !ctx || !master) return;
    this.built = true;
    // sea: low rumble with slow swell
    const sea = noiseSource(); if (!sea) return;
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 380;
    this.seaGain = ctx.createGain(); this.seaGain.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lfoG = ctx.createGain(); lfoG.gain.value = 0.35;
    const swell = ctx.createGain(); swell.gain.value = 0.65; lfo.connect(lfoG).connect(swell.gain); lfo.start();
    sea.connect(sf).connect(swell).connect(this.seaGain).connect(master); sea.start();
    // wind: hissy band whose level follows wind speed
    const wind = noiseSource(); if (!wind) return;
    this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 700; this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.21; const wlG = ctx.createGain(); wlG.gain.value = 0.4;
    const gust = ctx.createGain(); gust.gain.value = 0.6; wl.connect(wlG).connect(gust.gain); wl.start();
    wind.connect(this.windFilter).connect(gust).connect(this.windGain).connect(master); wind.start();
    this.musicGain = ctx.createGain(); this.musicGain.gain.value = 0; this.musicGain.connect(master);
    // rain: bright hiss
    const rain = noiseSource(); if (!rain) return;
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2200;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(rf).connect(this.rainGain).connect(master); rain.start();
  }

  setRain(intensity: number): void {
    if (!ctx || !this.rainGain) return;
    const on = save.sound && this.mode !== 'off';
    this.rainGain.gain.setTargetAtTime(on ? intensity * 0.22 : 0, ctx.currentTime, 0.8);
  }

  thunder(distance01: number): void {
    if (!ctx || !master || !save.sound || this.mode === 'off') return;
    const t = ctx.currentTime + 0.15 + distance01 * 1.5;
    const s = noiseSource(); if (!s) return;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(320, t); f.frequency.exponentialRampToValueAtTime(90, t + 2.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * (1 - distance01 * 0.6), t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + 3);
  }

  setMode(mode: 'menu' | 'game' | 'off', day = true): void {
    this.mode = mode; this.day = day;
    if (!ctx) return;
    this.build();
    const t = ctx.currentTime;
    this.seaGain?.gain.setTargetAtTime(mode === 'off' ? 0 : 0.28, t, 0.8);
  }

  update(dt: number, windKmh: number, timeScale = 1): void {
    if (!ctx || !this.built) return;
    const on = save.sound && this.mode !== 'off';
    const t = ctx.currentTime;
    if (this.windGain) this.windGain.gain.setTargetAtTime(on ? Math.min(0.5, windKmh / 40) : 0, t, 0.5);
    if (this.windFilter) this.windFilter.frequency.setTargetAtTime(500 + windKmh * 14, t, 0.5);
    if (!on) { this.seaGain?.gain.setTargetAtTime(0, t, 0.4); this.musicGain?.gain.setTargetAtTime(0, t, 0.4); return; }
    // gulls by day
    this.gullTimer -= dt;
    if (this.day && this.gullTimer <= 0) {
      this.gullTimer = 9 + Math.random() * 16;
      const n = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const t0 = t + i * (0.28 + Math.random() * 0.2);
        tone(1500 + Math.random() * 500, t0, 0.22, 'sine', 0.035, 2300);
        tone(2200, t0 + 0.2, 0.18, 'sine', 0.025, 1400);
      }
    }
    // music bed: slow chord pad with a sparse pentatonic melody
    const wantMusic = save.music && (this.mode === 'menu' || this.mode === 'game');
    this.musicGain?.gain.setTargetAtTime(wantMusic ? (this.mode === 'menu' ? 0.22 : 0.11) : 0, t, 1.2);
    if (wantMusic) {
      this.musicTimer -= dt * timeScale;
      if (this.musicTimer <= 0) {
        this.musicTimer = 3.6;
        const chords = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [174.6, 220, 261.6, 349.2], [196, 246.9, 293.7, 392]];
        const c = chords[this.chord % chords.length]; this.chord++;
        for (const f of c) this.pad(f, t, 3.8);
        const scale = [523.3, 587.3, 659.3, 784, 880, 1046.5];
        for (let k = 0; k < 3; k++) if (Math.random() < 0.7) this.pluck(scale[Math.floor(Math.random() * scale.length)], t + 0.4 + k * 1.1);
      }
    }
  }

  private pad(freq: number, t0: number, dur: number): void {
    if (!ctx || !this.musicGain) return;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 1.003;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.16, t0 + 1.4); g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(f); o2.connect(f); f.connect(g).connect(this.musicGain);
    o.start(t0); o2.start(t0); o.stop(t0 + dur + 0.1); o2.stop(t0 + dur + 0.1);
  }
  private pluck(freq: number, t0: number): void {
    if (!ctx || !this.musicGain) return;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
    o.connect(g).connect(this.musicGain); o.start(t0); o.stop(t0 + 1.7);
  }
}

// ---------------- engines ----------------

export interface EngineSource { id: number; kind: 'prop1' | 'prop2' | 'prop4' | 'jet2' | 'jet4' | 'rotor' | 'float'; x: number; y: number; speed: number; maxSpeed: number; altitude: number; state: string }

interface Voice { gain: GainNode; osc?: OscillatorNode; osc2?: OscillatorNode; filter?: BiquadFilterNode; lfo?: OscillatorNode; kind: string; nodes: AudioNode[] }

export class EngineMixer {
  private voices = new Map<number, Voice>();
  private bus: GainNode | null = null;
  private muted = false;

  setMuted(m: boolean): void { this.muted = m; }

  private ensureBus(): void {
    if (this.bus || !ctx || !master) return;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.9; this.bus.connect(master);
  }

  private create(src: EngineSource): Voice | null {
    if (!ctx || !this.bus) return null;
    const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(this.bus);
    const nodes: AudioNode[] = [];
    const isJet = src.kind.startsWith('jet');
    if (src.kind === 'rotor') {
      const n = noiseSource(); if (!n) return null;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 220; f.Q.value = 1.2;
      const chop = ctx.createGain(); chop.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 13; const lg = ctx.createGain(); lg.gain.value = 0.5;
      lfo.connect(lg).connect(chop.gain); lfo.start();
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 52; const og = ctx.createGain(); og.gain.value = 0.35;
      n.connect(f).connect(chop).connect(gain); o.connect(og).connect(chop); n.start(); o.start();
      nodes.push(n, o, lfo);
      return { gain, osc: o, filter: f, lfo, kind: src.kind, nodes };
    }
    if (isJet) {
      const n = noiseSource(); if (!n) return null;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.8;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 62; const og = ctx.createGain(); og.gain.value = 0.5;
      n.connect(f).connect(gain); o.connect(og).connect(gain); n.start(); o.start();
      nodes.push(n, o);
      return { gain, osc: o, filter: f, kind: src.kind, nodes };
    }
    // propeller: two detuned saws through a lowpass, plus a faint blade buzz
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 88;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 88 * 1.012;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 2;
    const mix = ctx.createGain(); mix.gain.value = 0.22;
    o.connect(mix); o2.connect(mix); mix.connect(f).connect(gain); o.start(); o2.start();
    nodes.push(o, o2);
    return { gain, osc: o, osc2: o2, filter: f, kind: src.kind, nodes };
  }

  /** Call every frame with the live aircraft list. viewW/viewH = world size for panning/attenuation. */
  update(sources: EngineSource[], timeScale = 1): void {
    if (!ctx) return;
    this.ensureBus();
    if (!this.bus) return;
    const on = save.sound && !this.muted;
    const t = ctx.currentTime;
    const seen = new Set<number>();
    const count = Math.max(1, sources.length);
    for (const s of sources) {
      seen.add(s.id);
      let v = this.voices.get(s.id);
      if (!v) { const nv = this.create(s); if (!nv) continue; v = nv; this.voices.set(s.id, v); }
      const thr = Math.min(1.2, s.speed / s.maxSpeed);
      const ground = s.altitude < 0.15;
      const base = s.kind.startsWith('jet') ? 0.13 : s.kind === 'rotor' ? 0.12 : s.kind === 'prop1' || s.kind === 'float' ? 0.075 : 0.095;
      const level = on ? base * (0.6 + 0.4 * thr) * (ground ? 0.5 : 1) / Math.sqrt(count) : 0;
      v.gain.gain.setTargetAtTime(level, t, 0.25);
      const pitch = (0.75 + 0.35 * thr) * (timeScale < 1 ? 0.8 : 1);
      if (v.kind.startsWith('jet')) {
        v.osc?.frequency.setTargetAtTime(62 * pitch, t, 0.3);
        v.filter?.frequency.setTargetAtTime(520 * pitch * (ground ? 0.6 : 1), t, 0.3);
      } else if (v.kind === 'rotor') {
        v.lfo?.frequency.setTargetAtTime(13 * pitch, t, 0.3);
        v.osc?.frequency.setTargetAtTime(52 * pitch, t, 0.3);
      } else {
        const f = (s.kind === 'prop2' || s.kind === 'prop4' ? 96 : 84) * pitch;
        v.osc?.frequency.setTargetAtTime(f, t, 0.3);
        v.osc2?.frequency.setTargetAtTime(f * 1.012, t, 0.3);
        v.filter?.frequency.setTargetAtTime(700 * pitch, t, 0.3);
      }
    }
    for (const [id, v] of this.voices) {
      if (seen.has(id)) continue;
      v.gain.gain.setTargetAtTime(0, t, 0.15);
      const nodes = v.nodes, gain = v.gain;
      setTimeout(() => { for (const n of nodes) { try { (n as AudioScheduledSourceNode).stop(); } catch { /* ok */ } n.disconnect(); } gain.disconnect(); }, 600);
      this.voices.delete(id);
    }
  }

  clear(): void { this.update([]); }
}

// ---------------- ATC radio ----------------

export type Speaker = 'tower' | 'pilot';

/** Radio chatter through speech synthesis, made to sound like a real VHF radio: squelch, static bed, two voices. */
export class Radio {
  private queue: Array<{ text: string; urgent: boolean; who: Speaker; t: number }> = [];
  private speaking = false;
  private voices: Record<Speaker, SpeechSynthesisVoice | null> = { tower: null, pilot: null };
  private static: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  private pickVoices(): void {
    if (this.voices.tower || !('speechSynthesis' in window)) return;
    const all = speechSynthesis.getVoices().filter(v => /^en(-|_)/i.test(v.lang));
    if (!all.length) return;
    // prefer the most natural voices the device offers (neural / premium / enhanced / Siri / Google)
    const score = (v: SpeechSynthesisVoice): number =>
      (/natural|neural|premium|enhanced|siri/i.test(v.name) ? 40 : 0) + (/google/i.test(v.name) ? 20 : 0) + (v.localService ? 5 : 0) + (/en-(US|GB)/i.test(v.lang) ? 10 : 0) - (/compact|espeak/i.test(v.name) ? 30 : 0);
    const ranked = all.slice().sort((x, y) => score(y) - score(x));
    const male = ranked.find(v => /guy|davis|daniel|george|ryan|alex|fred|tom|james|christopher|eric|brian|male/i.test(v.name));
    const female = ranked.find(v => /aria|jenny|samantha|sonia|libby|zira|karen|moira|female|emma|olivia/i.test(v.name));
    this.voices.tower = female ?? ranked[0];
    this.voices.pilot = male ?? ranked.find(v => v !== this.voices.tower) ?? ranked[0];
  }

  callsign(type: { callsign: string }, planeId: number): string {
    const num = ((planeId * 37) % 900) + 100;
    const digits = String(num).split('').map(d => ['zero', 'one', 'two', 'tree', 'four', 'five', 'six', 'seven', 'eight', 'niner'][+d]).join(' ');
    return `${type.callsign} ${digits}`;
  }

  say(text: string, opts: { urgent?: boolean; who?: Speaker } = {}): void {
    if (!save.radio || !save.sound || !('speechSynthesis' in window)) return;
    const urgent = !!opts.urgent, who = opts.who ?? 'tower';
    if (!urgent && this.queue.length >= 2) return; // no pile-up of chatter
    this.queue.push({ text, urgent, who, t: performance.now() });
    if (urgent) this.queue.sort((x, y) => Number(y.urgent) - Number(x.urgent));
    this.pump();
  }

  private staticOn(on: boolean): void {
    if (!ctx || !master) return;
    if (on && !this.static) {
      const src = noiseSource(); if (!src) return;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.05, ctx.currentTime, 0.05);
      src.connect(f).connect(g).connect(master); src.start();
      this.static = { src, gain: g };
    } else if (!on && this.static) {
      const st = this.static; this.static = null;
      st.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => { try { st.src.stop(); } catch { /* ok */ } st.src.disconnect(); st.gain.disconnect(); }, 300);
    }
  }

  private pump(): void {
    if (this.speaking || this.queue.length === 0) return;
    const item = this.queue.shift()!;
    if (!item.urgent && performance.now() - item.t > 6000) { this.pump(); return; }
    this.pickVoices();
    this.speaking = true;
    sfx.squelch(true); this.staticOn(true);
    const u = new SpeechSynthesisUtterance(item.text);
    const v = this.voices[item.who];
    u.lang = v?.lang ?? 'en-US';
    // natural pace, no pitch shifting: pitch tricks are what makes TTS sound robotic
    u.rate = item.who === 'pilot' ? 1.02 : 1.06; u.pitch = 1.0; u.volume = item.who === 'pilot' ? 0.7 : 0.8;
    if (v) u.voice = v;
    const done = (): void => { if (!this.speaking) return; this.speaking = false; this.staticOn(false); sfx.squelch(false); setTimeout(() => this.pump(), 650); };
    u.onend = done; u.onerror = done;
    try { speechSynthesis.speak(u); } catch { done(); }
    setTimeout(() => { if (this.speaking) done(); }, 8000);
  }

  stop(): void {
    this.queue = [];
    try { speechSynthesis.cancel(); } catch { /* ok */ }
    this.speaking = false; this.staticOn(false);
  }
}

export const runwayIdCallout = (id: string): string => {
  const digits = id.slice(0, 2).split('').map(d => ['zero', 'one', 'two', 'tree', 'four', 'five', 'six', 'seven', 'eight', 'niner'][+d] ?? d).join(' ');
  const side = id.slice(2);
  return `${digits}${side === 'L' ? ' left' : side === 'R' ? ' right' : side === 'C' ? ' centre' : ''}`;
};

export const runwayCallout = (headingRad: number): string => {
  const num = Math.round((((headingRad * 180 / Math.PI) + 90 + 360) % 360) / 10) || 36;
  return String(num).padStart(2, '0').split('').map(d => ['zero', 'one', 'two', 'tree', 'four', 'five', 'six', 'seven', 'eight', 'niner'][+d]).join(' ');
};

if ('speechSynthesis' in window) { try { speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); speechSynthesis.getVoices(); } catch { /* ok */ } }
