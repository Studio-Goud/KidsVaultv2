/**
 * Klankhuis - the sound house, in Suri.
 *
 * The instrument comes before the game. What opens is nine chimes you can hit, in tune, with a
 * proper strike and a room behind them; the ladder of levels is a button off to one side and the
 * sequencer is a button off the other. A child who never gets past the first screen has still
 * played an instrument.
 *
 * Everything that has a time in it is scheduled against `AudioContext.currentTime`, ahead of when
 * it sounds, and the drawing is worked out from that same clock. There is no `setTimeout` and no
 * note anywhere that hangs off a frame: a bouncing ball driven by `requestAnimationFrame` and a
 * note driven by the audio clock drift apart within seconds, and a rhythm game that is slightly
 * late is worth nothing at all.
 *
 * The teaching lives in the moment after a mistake. A tap that was late leaves a ring where it
 * landed with a line back to where the beat was, and then the bar plays again at half speed with
 * the right beat lit. A wrong chime in the echo levels is answered by the right one, straight
 * after, so the difference is something you hear rather than something you are told.
 */

import { clamp, TAU, type Vec } from '../../util/math';
import { safeArea, uiScale } from '../../util/ui';
import { unlockAudio } from '../../util/audio';
import { levelProgress, persist, recordLevelResult, save } from '../../util/storage';
import {
  bleedEdges, breathe, chunkyButton, drawStar, easeOutBack, glassPanel, handCursor,
  heading, hexA, outlinedText, Particles, roundRectPath, Shake, vignette,
} from '../../render/look';
import {
  audioNow, audioReady, cheer, click as tick, drum as hitDrum, fanfare, nudge, outputLatency,
  play as playNote, playChord, stopAll, uiTap, VOICES, voiceById, isVoiceId, type DrumKind,
} from './chimesfx';
import {
  beatSeconds, beatsPerBar, CHIME_MIDI, decodeGrid, encodeGrid, gridNoteCount, letterOfMidi,
  SEQ_PITCHES, SEQ_STEPS, stepNotes, tapGrade, tapSide, tapTightness, TAP_WINDOWS,
  type Grade, type Grid,
} from './music';
import {
  LEVELS, makeRound, rngFor, roundBeats, starsFor, type Level, type Round, type Sound,
} from './model';
import {
  bounceBall, chimeBar, chimeStand, colourOf, drawRoom, drumPad, gridCell, noteBlock, quaver,
  rung, tapRing,
} from './paint';
import { NL, T } from '../../util/lang';
import { speakLine } from '../../platform/voice';

type Ctx = CanvasRenderingContext2D;
type Phase = 'home' | 'levels' | 'play' | 'won';
type Step = 'count' | 'run' | 'listen' | 'answer' | 'judge' | 'teach' | 'seq';

const nameOf = (l: Level): string => (NL() ? l.nameNl : l.name);
const saveKey = (l: Level): string => `rhythm:${l.id}`;

interface Hit { id: string; x: number; y: number; w: number; h: number }
interface Rect { x: number; y: number; w: number; h: number }

interface Layout {
  prompt: Rect;
  /** the timeline, the ladder or the grid */
  stage: Rect;
  /** the chimes, or the drum */
  keys: Rect;
  wide: boolean;
}

/** One thing the game will play, at an absolute moment on the audio clock. */
interface Ev {
  at: number;
  kind: 'note' | 'click' | 'drum';
  midi?: number;
  dur?: number;
  strong?: boolean;
  drum?: DrumKind;
  level?: number;
  /** which beat of the pattern it belongs to, for the debug handle */
  beat: number;
}

/** What the child did, and how close it was. */
interface Tap {
  beat: number;
  askIndex: number | null;
  grade: Grade;
  deltaMs: number;
  t: number;
}

/** How far ahead notes are handed to the audio clock. A quarter of a second is plenty. */
const LOOKAHEAD = 0.25;
/** The four speeds the sequencer offers. Nothing else may end up in the save. */
const TEMPOS = [80, 100, 120, 140];
/** how long the marks stay up before the bar is replayed or the next round starts */
const JUDGE_FOR = 1.5;

export class Rhythm {
  private ctx: Ctx;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private fullH = 0;
  private st = 0;
  private sb = 0;
  /** the notch and the home bar when the phone is on its side, which live left and right */
  private sl = 0;
  private sr = 0;
  private fullW = 0;
  private t = 0;
  private raf = 0;

  private phase: Phase = 'home';
  private step: Step = 'count';
  private levelIndex = 0;
  private level: Level = LEVELS[0];
  private rng = rngFor(LEVELS[0], 0);
  private attempt = 0;
  private roundNo = 0;
  private round: Round = makeRound(LEVELS[0], rngFor(LEVELS[0], 0), 0);
  private firstTry = 0;
  private earned = 0;

  // ---- the clock
  /** audio time of beat zero of the pattern now running */
  private t0 = 0;
  /** the tempo actually running: the round's, or half of it during the replay */
  private bpmNow = 80;
  private queue: Ev[] = [];
  private qi = 0;
  /** where the pattern ends, in beats */
  private endBeat = 0;

  // ---- what happened
  private taps: Tap[] = [];
  /** grade per asked beat, or null where nothing landed */
  private got: (Grade | null)[] = [];
  private answered: number[] = [];
  private wrongAt = -1;
  private wrongMidi = 0;
  private clean = true;
  private picked: number | null = null;
  private hitFlash = 0;
  /** when each chime last sounded, on the audio clock, so the bars glow in time */
  private struck: number[] = CHIME_MIDI.map(() => -9);

  // ---- the sequencer
  private grid: Grid = decodeGrid([]);
  private seqOn = false;
  private seqT0 = 0;
  private seqI = 0;
  private voice = 'chime';
  private seqBpm = 100;
  private madeSomething = false;

  private hits: Hit[] = [];
  private held0: string | null = null;
  private ps = new Particles();
  private shake = new Shake();
  private cardPop = 0;
  private note = '';
  private noteT = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.loadMade();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('pointerdown', e => this.onDown(e));
    canvas.addEventListener('pointerup', () => { this.held0 = null; });
    canvas.addEventListener('pointercancel', () => { this.held0 = null; });
    (window as unknown as { __rhythm?: Rhythm }).__rhythm = this;
    const loop = (ms: number): void => {
      const now = ms / 1000;
      const dt = Math.min(0.05, now - this.t || 0);
      this.t = now;
      this.update(dt);
      this.draw();
      bleedEdges(this.ctx, this.canvas, this.w, this.dpr, this.st, this.sb, this.h, this.sl, this.sr);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void { cancelAnimationFrame(this.raf); stopAll(); }

  canBack(): boolean { return this.phase !== 'home'; }
  back(): void {
    stopAll();
    this.seqOn = false;
    if (this.phase === 'play' || this.phase === 'won') this.phase = 'levels';
    else this.phase = 'home';
    this.cardPop = 0;
  }

  // ---------------------------------------------------------------- the saved tune

  /**
   * What the child made, read back out of the one save object, and never trusted.
   *
   * A grid that has been truncated, hand-edited or left over from a different size of grid comes
   * back as eight zeroes rather than as an exception on the way in.
   */
  private loadMade(): void {
    this.grid = decodeGrid(save.rhythm.steps);
    this.voice = isVoiceId(save.rhythm.voice) ? save.rhythm.voice : 'chime';
    // whatever the save says, the tempo has to be one of the four the button cycles through,
    // or pressing it once would jump to somewhere unrelated
    const want = Math.round(save.rhythm.tempo || 100);
    this.seqBpm = TEMPOS.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a), TEMPOS[1]);
    this.madeSomething = gridNoteCount(this.grid) > 0;
  }

  private saveMade(): void {
    save.rhythm.steps = encodeGrid(this.grid);
    save.rhythm.voice = this.voice;
    save.rhythm.tempo = this.seqBpm;
    persist();
  }

  // ---------------------------------------------------------------- the debug handle

  debugState(): Record<string, unknown> {
    const L = this.layout();
    const now = audioNow();
    return {
      phase: this.phase,
      step: this.step,
      level: this.level.id,
      levelIndex: this.levelIndex,
      kind: this.level.kind,
      round: this.roundNo,
      rounds: this.level.rounds,
      firstTry: this.firstTry,
      stars: this.earned,
      clean: this.clean,
      audioReady: audioReady(),
      /** the audio clock itself, and where beat zero of this pattern sits on it */
      audioNow: Number(now.toFixed(4)),
      t0: Number(this.t0.toFixed(4)),
      bpm: this.bpmNow,
      beatSeconds: Number((60 / this.bpmNow).toFixed(6)),
      /** where the pattern is now, in beats. Negative during the count-in */
      beat: Number(this.beatPos().toFixed(3)),
      endBeat: this.endBeat,
      outputLatency: Number(outputLatency().toFixed(4)),
      /** every note of this pattern: the beat it is on, and the moment it was handed to the clock */
      scheduled: this.queue.map(e => ({
        beat: e.beat, at: Number(e.at.toFixed(4)), kind: e.kind, midi: e.midi ?? null,
      })),
      scheduledUpTo: this.qi,
      asks: this.round.asks,
      /** the absolute moment of the next beat the child still has to hit */
      nextAskAt: this.nextAskAt(),
      taps: this.taps.map(t => ({
        beat: Number(t.beat.toFixed(3)), ask: t.askIndex, grade: t.grade, deltaMs: Math.round(t.deltaMs),
      })),
      got: this.got,
      answer: this.round.answer,
      answered: this.answered,
      pair: this.round.pair,
      blanks: this.round.blanks,
      tune: this.round.tune?.id ?? null,
      windows: TAP_WINDOWS,
      grid: encodeGrid(this.grid),
      gridNotes: gridNoteCount(this.grid),
      voice: this.voice,
      seqBpm: this.seqBpm,
      seqOn: this.seqOn,
      seqStep: this.seqOn ? this.seqPos() : -1,
      keys: { x: Math.round(L.keys.x), y: Math.round(L.keys.y), w: Math.round(L.keys.w), h: Math.round(L.keys.h) },
      buttons: this.hits.map(b => ({
        id: b.id, x: Math.round(b.x + b.w / 2), y: Math.round(b.y + b.h / 2),
        w: Math.round(b.w), h: Math.round(b.h),
      })),
    };
  }

  /** The absolute moment on the audio clock of the next beat still to be hit, or null. */
  private nextAskAt(): number | null {
    const i = this.got.findIndex(g => g === null);
    if (i < 0) return null;
    const beat = this.round.asks[i];
    if (beat === undefined) return null;
    return this.t0 + beat * (60 / this.bpmNow);
  }

  // ---------------------------------------------------------------- the clock

  /** Where the pattern is, in beats. Negative while the count-in is running. */
  private beatPos(): number { return (audioNow() - this.t0) * (this.bpmNow / 60); }

  private seqPos(): number {
    const sec = beatSeconds(this.seqBpm);
    const s = Math.floor((audioNow() - this.seqT0) / sec);
    return ((s % SEQ_STEPS) + SEQ_STEPS) % SEQ_STEPS;
  }

  /**
   * Hand everything due within the look-ahead to the audio clock.
   *
   * Each event carries the absolute moment it belongs at, so the delay between this frame and the
   * one before it changes nothing at all about when the note sounds.
   */
  private pump(): void {
    const until = audioNow() + LOOKAHEAD;
    while (this.qi < this.queue.length && this.queue[this.qi].at <= until) {
      const e = this.queue[this.qi++];
      if (e.kind === 'click') tick(e.at, !!e.strong);
      else if (e.kind === 'drum') hitDrum(e.drum ?? 'kick', e.at, e.level ?? 1);
      else if (e.midi !== undefined) {
        playNote(e.midi, e.at, e.dur ?? 1, this.voiceForLevel(), e.level ?? 1);
        // The bar lights at the moment the note sounds, which is up to a look-ahead later than
        // now - except in the ear levels, where a lit bar would hand over the answer. Echo and
        // High and low are about hearing which note it was; if the instrument shows you, they
        // are a copying exercise instead.
        if (!this.blindLevel()) {
          const i = CHIME_MIDI.indexOf(e.midi);
          if (i >= 0) this.struck[i] = e.at;
        }
      }
    }
  }

  /** Levels where the game's own notes must leave no mark on the screen at all. */
  private blindLevel(): boolean {
    return this.level.kind === 'echo' || this.level.kind === 'pitch';
  }

  private voiceForLevel(): string {
    if (this.level.kind === 'make') return this.voice;
    return this.level.kind === 'tap' || this.level.kind === 'together' ? 'wood' : 'chime';
  }

  // ---------------------------------------------------------------- starting things

  private unlocked(i: number): boolean {
    // the sequencer is never locked: it is the point of the game, and a child who has to earn
    // eight levels before being allowed to make anything will never make anything
    if (LEVELS[i].kind === 'make') return true;
    return i === 0 || levelProgress(saveKey(LEVELS[i - 1])).completed;
  }

  private start(i: number): void {
    stopAll();
    this.levelIndex = clamp(i, 0, LEVELS.length - 1);
    this.level = LEVELS[this.levelIndex];
    this.attempt++;
    this.rng = rngFor(this.level, this.attempt);
    this.roundNo = 0;
    this.firstTry = 0;
    this.earned = 0;
    this.ps.clear();
    this.cardPop = 0;
    this.phase = 'play';
    this.seqOn = false;
    if (this.level.kind === 'make') {
      this.step = 'seq';
      this.say(NL() ? this.level.hintNl : this.level.hint, 7);
      return;
    }
    this.beginRound();
    this.say(NL() ? this.level.hintNl : this.level.hint, 7);
  }

  private beginRound(): void {
    this.round = makeRound(this.level, this.rng, this.roundNo);
    this.bpmNow = this.round.bpm;
    this.taps = [];
    this.got = this.round.asks.map(() => null);
    this.answered = [];
    this.wrongAt = -1;
    this.clean = true;
    this.picked = null;
    this.endBeat = roundBeats(this.round);
    const needsCount = this.level.kind === 'tap' || this.level.kind === 'together';
    this.step = needsCount ? 'count' : 'listen';
    this.buildQueue(needsCount);
    if (this.round.say) this.say(NL() ? this.round.sayNl : this.round.say, 3);
  }

  /**
   * Lay the whole round out on the audio clock in one go.
   *
   * Beat zero is put far enough in the future that the first note is scheduled rather than
   * squeezed in, and every other moment is beat zero plus a number of beats - never the previous
   * moment plus a gap, which is how a sequence built as it goes ends up behind.
   */
  private buildQueue(withCount: boolean, half = false, from = 0, len = Infinity): void {
    const per = beatsPerBar(this.round.sig);
    const bpm = half ? this.round.bpm / 2 : this.round.bpm;
    this.bpmNow = bpm;
    const sec = 60 / bpm;
    const lead = 0.28;
    // beat zero of the round keeps its meaning even when only one bar of it is being replayed:
    // the playhead then simply starts partway along the same timeline
    this.t0 = audioNow() + lead + (withCount ? per * sec : 0) - from * sec;
    this.queue = [];
    this.qi = 0;
    if (withCount) {
      for (let b = 0; b < per; b++) {
        this.queue.push({ at: this.t0 - (per - b) * sec, kind: 'click', strong: b === 0, beat: b - per });
      }
    }
    for (const s of this.round.sounds) {
      if (s.beat < from || s.beat >= from + len) continue;
      if (this.level.kind === 'tune' && this.isBlank(s)) continue;
      if (s.midi === null) {
        this.queue.push({ at: this.t0 + s.beat * sec, kind: 'click', strong: s.stress === 'strong', beat: s.beat });
      } else {
        this.queue.push({
          at: this.t0 + s.beat * sec, kind: 'note', midi: s.midi,
          dur: Math.max(0.35, s.beats * sec * 0.95),
          level: s.stress === 'strong' ? 1 : s.stress === 'medium' ? 0.85 : 0.72,
          beat: s.beat,
        });
      }
    }
    this.queue.sort((a, b) => a.at - b.at);
  }

  /** In the song level, the notes that were taken out are the ones the child has to find. */
  private isBlank(s: Sound): boolean {
    if (this.level.kind !== 'tune') return false;
    const i = this.round.sounds.indexOf(s);
    return this.round.blanks.includes(i);
  }

  /** The last thing the game said, so the guide in the corner can say it again. */
  spoken(): string { return this.note; }

  private say(text: string, secs = 3.5): void {
    this.note = text;
    this.noteT = secs;
    // audio-first: the note is the game's instruction, so it is heard as well as read.
    // Today that is the machine's own voice; a recording slots in without touching this.
    speakLine(text);
  }

  // ---------------------------------------------------------------- the run of a round

  private update(dt: number): void {
    this.noteT = Math.max(0, this.noteT - dt);
    this.ps.update(dt);
    this.shake.update(dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 3.2);
    this.cardPop = Math.min(1, this.cardPop + dt * 2.8);
    if (this.seqOn) this.pumpSeq();
    if (this.phase !== 'play') return;
    if (this.step === 'seq') return;
    this.pump();

    const pos = this.beatPos();
    if (this.step === 'count') {
      if (pos >= 0) this.step = 'run';
      return;
    }
    if (this.step === 'run') {
      // a tail past the last beat, so a tap that was late on the final beat still counts
      if (pos > this.endBeat - 1 + TAP_WINDOWS.ok / 1000 * (this.bpmNow / 60) + 0.35) this.toJudge();
      return;
    }
    if (this.step === 'listen') {
      if (pos > this.endBeat + 0.45) {
        this.step = 'answer';
        if (this.level.kind === 'pitch') this.say(NL() ? this.round.sayNl : this.round.say, 5);
      }
      return;
    }
    if (this.step === 'judge') {
      if (this.t - this.judgeT > JUDGE_FOR) {
        if (this.clean) this.advance();
        else this.toTeach();
      }
      return;
    }
    if (this.step === 'teach') {
      if (pos > this.teachFrom + this.teachLen + 0.6) this.advance();
    }
  }

  private judgeT = 0;
  /** which bar of the round is being replayed, and how long it is */
  private teachFrom = 0;
  private teachLen = 4;

  private toJudge(): void {
    this.step = 'judge';
    this.judgeT = this.t;
    this.clean = this.got.every(g => g !== null && g !== 'miss');
    if (this.clean) {
      cheer();
      const L = this.layout();
      this.ps.spawn('spark', L.stage.x + L.stage.w / 2, L.stage.y + L.stage.h / 2, 16, {
        colour: '#ffd873', speed: 260, size: 12, max: 0.9, spread: TAU,
      });
    } else {
      nudge();
      this.shake.add(0.4);
    }
  }

  /**
   * The bar that went wrong, again, at half speed, with the beats lit as they come.
   *
   * One bar and not the whole pattern: four beats at half speed is already six seconds, and a
   * child who has just got something wrong will not sit through twelve. In the ear levels there
   * is nothing to replay - the right note was played the moment the wrong one was, which is the
   * teaching there.
   */
  private toTeach(): void {
    if (this.level.kind !== 'tap' && this.level.kind !== 'together') { this.advance(); return; }
    const per = beatsPerBar(this.round.sig);
    const firstBad = this.got.findIndex(g => g === null || g === 'miss');
    const badBeat = firstBad >= 0
      ? this.round.asks[firstBad]
      : (this.taps.find(t => t.grade !== 'perfect')?.beat ?? 0);
    const bar = clamp(Math.floor(badBeat / per), 0, Math.max(0, this.round.bars - 1));
    this.teachFrom = bar * per;
    this.teachLen = per;
    this.step = 'teach';
    this.buildQueue(false, true, this.teachFrom, this.teachLen);
    this.say(T('Listen once more, slowly. Tap where the rings are.',
      'Luister nog eens, langzaam. Tik waar de ringen staan.'), 4);
  }

  private advance(): void {
    if (this.clean) this.firstTry++;
    this.roundNo++;
    if (this.roundNo >= this.level.rounds) {
      this.finish();
      return;
    }
    this.beginRound();
  }

  private finish(): void {
    this.earned = starsFor(this.firstTry, this.level.rounds);
    recordLevelResult(saveKey(this.level), this.firstTry, this.earned, true);
    save.coins = Math.max(0, Math.round(save.coins + 10 + this.earned * 10));
    persist();
    this.phase = 'won';
    this.cardPop = 0;
    fanfare();
  }

  // ---------------------------------------------------------------- taps

  /**
   * A tap on the drum, judged against the audio clock.
   *
   * The moment used is when the child *heard* the beat, not when the browser queued it, so the
   * output latency comes off before anything is compared. Getting that wrong makes the game
   * uniformly late and no amount of practice fixes it.
   */
  private tapBeat(): void {
    if (this.step !== 'run') return;
    const heard = audioNow() - outputLatency();
    const beat = (heard - this.t0) * (this.bpmNow / 60);
    const sec = 60 / this.bpmNow;
    let best = -1, bestD = Infinity;
    this.round.asks.forEach((b, i) => {
      if (this.got[i] !== null) return;
      const d = Math.abs(b - beat);
      if (d < bestD) { bestD = d; best = i; }
    });
    const deltaMs = best >= 0 ? (beat - this.round.asks[best]) * sec * 1000 : 9999;
    const grade = tapGrade(deltaMs);
    const claimed = best >= 0 && grade !== 'miss';
    if (claimed) this.got[best] = grade;
    this.taps.push({ beat, askIndex: claimed ? best : null, grade, deltaMs, t: this.t });
    this.hitFlash = 1;
    hitDrum(this.level.kind === 'together' ? 'kick' : 'snare', audioNow(), claimed ? 1 : 0.6);
    if (claimed && grade === 'perfect') {
      const L = this.layout();
      this.ps.spawn('spark', L.keys.x + L.keys.w / 2, L.keys.y + L.keys.h * 0.4, 6, {
        colour: '#ffe28a', speed: 180, size: 8, max: 0.5, spread: TAU,
      });
    }
  }

  /** A chime struck by the child: always sounds, whatever the level makes of it. */
  private strike(i: number): void {
    const midi = CHIME_MIDI[i];
    const now = audioNow();
    this.struck[i] = now;
    playNote(midi, now, 1.1, this.voiceForLevel(), 0.95);
    if (this.phase === 'home' || this.phase === 'levels') return;
    if (this.step !== 'answer') return;
    if (this.level.kind === 'echo' || this.level.kind === 'tune') this.answerNote(midi);
    else if (this.level.kind === 'pitch' && this.round.pair?.exact) this.answerRung(i);
  }

  /**
   * One note of the echo, or one gap in the song.
   *
   * A wrong note is answered by the right one three tenths of a second later - long enough for
   * the two to be separate sounds and short enough for them to be the same thought. Then the
   * game moves on: being stuck on a note you cannot hear teaches nothing.
   */
  private answerNote(midi: number): void {
    const k = this.answered.length;
    const want = this.round.answer[k];
    if (want === undefined) return;
    this.answered.push(midi);
    if (midi !== want) {
      this.clean = false;
      this.wrongAt = k;
      this.wrongMidi = midi;
      const at = audioNow() + 0.32;
      playNote(want, at, 1.3, 'chime', 1);
      const wi = CHIME_MIDI.indexOf(want);
      if (wi >= 0) this.struck[wi] = at;
      this.shake.add(0.25);
      this.say(T('That one. Hear the difference?', 'Deze. Hoor je het verschil?'), 2.6);
    }
    if (this.answered.length >= this.round.answer.length) {
      // the song gets played back whole, with the gaps filled, because that is the reward
      if (this.level.kind === 'tune') this.playWhole();
      this.step = 'judge';
      this.judgeT = this.t + (this.level.kind === 'tune' ? 1.2 : 0);
      if (this.clean) { this.noteT = 0; cheer(); }
    }
  }

  /** The finished song, gaps and all, once the child has filled them. */
  private playWhole(): void {
    const sec = 60 / this.round.bpm;
    const t = audioNow() + 0.45;
    for (const s of this.round.sounds) {
      if (s.midi === null) continue;
      playNote(s.midi, t + s.beat * sec, Math.max(0.4, s.beats * sec * 0.95), 'chime', 0.9);
    }
  }

  private answerRung(i: number): void {
    const pair = this.round.pair;
    if (!pair || this.picked !== null) return;
    this.picked = i;
    const right = CHIME_MIDI.indexOf(pair.b);
    if (i !== right) {
      this.clean = false;
      const t = audioNow() + 0.2;
      playNote(pair.a, t, 1, 'chime', 0.9);
      playNote(pair.b, t + 0.55, 1.3, 'chime', 1);
      this.struck[CHIME_MIDI.indexOf(pair.a)] = t;
      this.struck[right] = t + 0.55;
      this.say(T('This one was the second note.', 'Dit was de tweede noot.'), 3);
    } else { this.noteT = 0; cheer(); }
    this.step = 'judge';
    this.judgeT = this.t + (this.clean ? 0 : 0.8);
  }

  private answerWay(higher: boolean): void {
    const pair = this.round.pair;
    if (!pair || this.picked !== null) return;
    this.picked = higher ? 1 : 0;
    const right = pair.b > pair.a;
    if (higher !== right) {
      this.clean = false;
      const t = audioNow() + 0.2;
      playNote(pair.a, t, 1, 'chime', 0.9);
      playNote(pair.b, t + 0.6, 1.4, 'chime', 1);
      this.say(right
        ? T('The second one went up.', 'De tweede ging omhoog.')
        : T('The second one went down.', 'De tweede ging omlaag.'), 3);
    } else { this.noteT = 0; cheer(); }
    this.step = 'judge';
    this.judgeT = this.t + (this.clean ? 0 : 1.2);
  }

  /** Play the phrase again. Free: an ear is trained by listening, not by being marked down. */
  private again(): void {
    if (this.level.kind === 'pitch') {
      const pair = this.round.pair;
      if (!pair) return;
      const t = audioNow() + 0.15;
      playNote(pair.a, t, 1, 'chime', 0.9);
      playNote(pair.b, t + 0.75, 1.4, 'chime', 1);
      return;
    }
    this.buildQueue(false);
    this.step = 'listen';
  }

  // ---------------------------------------------------------------- the sequencer

  /** Keep the loop a quarter of a second ahead of itself, for ever, without drifting. */
  private pumpSeq(): void {
    const sec = beatSeconds(this.seqBpm);
    const until = audioNow() + LOOKAHEAD;
    let guard = 0;
    while (this.seqT0 + this.seqI * sec <= until && guard++ < 64) {
      const at = this.seqT0 + this.seqI * sec;
      const notes = stepNotes(this.grid, this.seqI);
      if (notes.length) playChord(notes, at, Math.max(0.5, sec * 1.6), this.voice, 0.95);
      this.seqI++;
    }
  }

  private seqPlay(): void {
    this.seqOn = true;
    this.seqI = 0;
    this.seqT0 = audioNow() + 0.14;
    if (gridNoteCount(this.grid) >= 4 && !levelProgress(saveKey(LEVELS[LEVELS.length - 1])).completed) {
      // the making level is finished by making something, not by being marked
      recordLevelResult(saveKey(LEVELS[LEVELS.length - 1]), gridNoteCount(this.grid), 3, true);
      this.say(T('That is your tune. It will still be here tomorrow.',
        'Dat is jouw deuntje. Morgen staat het er nog.'), 4);
    }
  }

  private seqStop(): void { this.seqOn = false; stopAll(); }

  // ---------------------------------------------------------------- layout

  private u(): number { return uiScale(this.w, this.h); }

  private resize(): void {
    const safe = safeArea();
    this.st = safe.top;
    this.sb = safe.bottom;
    this.sl = safe.left;
    this.sr = safe.right;
    this.fullH = Math.max(1, window.innerHeight);
    this.fullW = Math.max(1, window.innerWidth);
    this.w = Math.max(1, this.fullW - this.sl - this.sr);
    this.h = Math.max(1, this.fullH - this.st - this.sb);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.canvas.width = Math.round(this.fullW * this.dpr);
    this.canvas.height = Math.round(this.fullH * this.dpr);
  }

  private font(weight: string, size: number): string {
    return `${weight} ${Math.round(size * this.u())}px Nunito, system-ui, sans-serif`;
  }

  private layout(): Layout {
    const u = this.u(), w = this.w, h = this.h;
    const wide = w > h * 1.3;
    const pad = Math.max(10, 13 * u);
    const top = 62 * u;
    const promptH = (this.level.kind === 'make' ? 0 : 62) * u;
    const prompt: Rect = { x: pad, y: top, w: w - pad * 2, h: promptH };
    const keysTop = promptH + top + (promptH ? 8 * u : 0);

    // The chimes, or the drum, along the bottom. On a wide short screen they get less height,
    // because the thing above them needs what is left. The chimes get more than the drum does:
    // nine bars a child has to aim at want the room, and a drum is one big target.
    const onChimes = this.level.kind === 'echo' || this.level.kind === 'tune';
    const keysH = this.level.kind === 'make' ? 0
      : onChimes
        ? Math.min(wide ? 132 * u : 268 * u, h * (wide ? 0.46 : 0.4))
        : Math.min(wide ? 126 * u : 252 * u, h * (wide ? 0.44 : 0.33));
    // the frame the chimes hang in needs a rail above the longest bar and one below it
    const rail = 16 * u;
    const keys: Rect = {
      x: pad + rail * 0.8, y: h - keysH - pad * 0.8 - rail,
      w: w - pad * 2 - rail * 1.6, h: keysH,
    };
    const stage: Rect = {
      x: pad, y: keysTop,
      w: w - pad * 2,
      h: Math.max(60 * u, (keysH ? keys.y - 10 * u : h - pad) - keysTop),
    };
    return { prompt, stage, keys, wide };
  }

  /** The nine bars across the bottom, with the low ones drawn long and the high ones short. */
  private chimeRects(r: Rect): Rect[] {
    const n = CHIME_MIDI.length;
    const gap = this.w < 360 ? 2 : Math.max(3, this.w * 0.008);
    const bw = (r.w - gap * (n - 1)) / n;
    return CHIME_MIDI.map((_, i) => {
      const k = i / (n - 1);
      const bh = r.h * (1 - k * 0.34);
      return { x: r.x + i * (bw + gap), y: r.y, w: bw, h: bh };
    });
  }

  // ---------------------------------------------------------------- input

  private at(e: PointerEvent): Vec {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - this.sl, y: e.clientY - r.top - this.st };
  }

  private hitAt(p: Vec): string | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h) return h.id;
    }
    return null;
  }

  private onDown(e: PointerEvent): void {
    unlockAudio();
    const p = this.at(e);
    const hit = this.hitAt(p);
    if (hit) { this.held0 = hit; this.press(hit); return; }
    // a tapping level takes a tap anywhere it is not something else, because a child aiming at a
    // drum while watching a ball will miss the drum
    if (this.phase === 'play' && this.step === 'run'
      && (this.level.kind === 'tap' || this.level.kind === 'together')) this.tapBeat();
  }

  private press(id: string): void {
    if (id.startsWith('chime:')) { this.strike(Number(id.slice(6))); return; }
    if (id.startsWith('cell:')) {
      const [s, p] = id.slice(5).split(',').map(Number);
      const on = !this.grid[s][p];
      this.grid[s][p] = on;
      if (on) playNote(CHIME_MIDI[p], audioNow(), 1, this.voice, 0.9);
      else uiTap();
      this.madeSomething = gridNoteCount(this.grid) > 0;
      this.saveMade();
      return;
    }
    if (id.startsWith('level:')) {
      const i = Number(id.slice(6));
      if (this.unlocked(i)) { uiTap(); this.start(i); } else nudge();
      return;
    }
    if (id.startsWith('rung:')) { this.answerRung(Number(id.slice(5))); return; }
    switch (id) {
      case 'pad': this.tapBeat(); break;
      case 'levels': uiTap(); stopAll(); this.seqOn = false; this.phase = 'levels'; this.cardPop = 0; break;
      case 'home': uiTap(); stopAll(); this.seqOn = false; this.phase = 'home'; this.cardPop = 0; break;
      case 'make': uiTap(); this.start(LEVELS.length - 1); break;
      case 'retry': uiTap(); this.start(this.levelIndex); break;
      case 'next': uiTap(); this.start(Math.min(LEVELS.length - 1, this.levelIndex + 1)); break;
      case 'again': uiTap(); this.again(); break;
      case 'go': if (this.step === 'judge') { this.clean ? this.advance() : this.toTeach(); } break;
      case 'higher': this.answerWay(true); break;
      case 'lower': this.answerWay(false); break;
      case 'play': uiTap(); this.seqOn ? this.seqStop() : this.seqPlay(); break;
      case 'clear':
        uiTap();
        this.grid = decodeGrid([]);
        this.madeSomething = false;
        this.saveMade();
        break;
      case 'voice': {
        const i = VOICES.findIndex(v => v.id === this.voice);
        this.voice = VOICES[(i + 1) % VOICES.length].id;
        this.saveMade();
        playNote(CHIME_MIDI[3], audioNow(), 1.2, this.voice, 0.95);
        this.say(NL() ? voiceById(this.voice).nameNl : voiceById(this.voice).name, 2);
        break;
      }
      case 'tempo': {
        const i = TEMPOS.indexOf(this.seqBpm);
        this.seqBpm = TEMPOS[(i + 1) % TEMPOS.length];
        this.saveMade();
        if (this.seqOn) { this.seqI = 0; this.seqT0 = audioNow() + 0.12; }
        uiTap();
        break;
      }
      default: break;
    }
  }

  // ---------------------------------------------------------------- drawing

  private draw(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.translate(this.sl, this.st);
    this.hits = [];
    drawRoom(ctx, this.w, this.h, this.t);
    if (this.phase === 'home') { this.drawHome(); vignette(ctx, this.w, this.h, 0.22); return; }
    if (this.phase === 'levels') { this.drawLevels(); vignette(ctx, this.w, this.h, 0.22); return; }
    ctx.save();
    this.shake.apply(ctx, 6 * this.u());
    this.drawPlay();
    ctx.restore();
    vignette(ctx, this.w, this.h, 0.22);
    this.drawChrome();
    if (this.phase === 'won') this.drawEnd();
  }

  // ---- the opening screen: the instrument, and two doors off it

  private drawHome(): void {
    const ctx = this.ctx, u = this.u();
    const wide = this.w > this.h * 1.3;
    ctx.textAlign = 'center';
    ctx.font = this.font('900', wide ? 22 : 26);
    const hx = this.headX('Klankhuis');
    heading(ctx, 'Klankhuis', hx, 44 * u, this.font('900', wide ? 22 : 26), '#fff2d8');
    ctx.fillStyle = 'rgba(255, 244, 222, 0.82)';
    ctx.font = this.font('700', 11.5);
    const tag = T('Hit the chimes. Then make something with them.', 'Sla op de klokjes. Maak er daarna iets mee.');
    this.wrapText(tag, this.headX(tag), 66 * u, this.w - 120 * u, 14 * u, 2);

    const pad = Math.max(10, 13 * u);
    const bh = 52 * u;
    const by = this.h - bh - 14 * u;
    const top = 92 * u;
    const room = by - 20 * u - top;
    // the instrument is the screen, not a strip along the bottom of it: it takes most of what is
    // between the title and the two buttons, and sits in the middle of that
    const keysH = Math.max(90 * u, Math.min(wide ? 190 * u : 400 * u, room * 0.86));
    const keys: Rect = { x: pad, y: top + (room - keysH) / 2, w: this.w - pad * 2, h: keysH };
    this.drawChimes(keys, { free: true });

    const bw = Math.min(170 * u, (this.w - pad * 2 - 12 * u) / 2);
    this.button('levels', T('Levels', 'Niveaus'), this.w / 2 - bw - 6 * u, by, bw, bh, '#f0b653', '#40260a');
    this.button('make', T('Make your own', 'Zelf maken'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
  }

  // ---- the ladder

  private drawLevels(): void {
    const ctx = this.ctx, u = this.u();
    ctx.textAlign = 'center';
    ctx.font = this.font('900', 23);
    heading(ctx, 'Klankhuis', this.headX('Klankhuis'), 42 * u, this.font('900', 23), '#fff2d8');
    ctx.fillStyle = 'rgba(255, 244, 222, 0.8)';
    ctx.font = this.font('700', 11.5);
    const tag = T('Beat, bar and tune, one step at a time.', 'Tel, maat en melodie, stap voor stap.');
    this.wrapText(tag, this.headX(tag), 64 * u, this.w - 120 * u, 13 * u, 2);

    const cols = this.w > 620 * u ? 4 : this.w > 430 * u ? 3 : 2;
    const pad = 11 * u;
    const cw = Math.min(190 * u, (this.w - 24 * u - (cols - 1) * pad) / cols);
    const art = cw * 0.5;
    const chh = art + 48 * u;
    const total = cols * cw + (cols - 1) * pad;
    const x0 = (this.w - total) / 2;
    const listTop = 80 * u;
    const rows = Math.ceil(LEVELS.length / cols);
    const needed = rows * chh + (rows - 1) * pad;
    const squeeze = Math.min(1, (this.h - listTop - 14 * u) / needed);

    ctx.save();
    if (squeeze < 1) {
      ctx.translate(this.w / 2, listTop);
      ctx.scale(squeeze, squeeze);
      ctx.translate(-this.w / 2, -listTop);
    }
    LEVELS.forEach((L, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (cw + pad), y = listTop + row * (chh + pad);
      const open = this.unlocked(i);
      const p = levelProgress(saveKey(L));
      const appear = easeOutBack(clamp(this.cardPop * 1.5 - i * 0.045, 0, 1));
      ctx.save();
      ctx.translate(x + cw / 2, y + chh / 2);
      ctx.scale(appear, appear);
      ctx.translate(-(x + cw / 2), -(y + chh / 2));
      ctx.save();
      ctx.shadowColor = 'rgba(8, 20, 34, 0.42)';
      ctx.shadowBlur = 16 * u;
      ctx.shadowOffsetY = 5 * u;
      ctx.fillStyle = open ? '#fff8ea' : '#e4dccd';
      roundRectPath(ctx, x, y, cw, chh, 16 * u);
      ctx.fill();
      ctx.restore();

      this.levelArt(i, x, y, cw, art, open);

      ctx.fillStyle = 'rgba(12,32,52,0.55)';
      ctx.beginPath(); ctx.arc(x + 19 * u, y + 19 * u, 12 * u, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = this.font('900', 11);
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, x + 19 * u, y + 23 * u);

      ctx.fillStyle = open ? '#123047' : 'rgba(18,48,71,0.55)';
      ctx.font = this.font('900', 12.5);
      ctx.fillText(nameOf(L), x + cw / 2, y + art + 16 * u, cw - 14 * u);
      for (let sI = 0; sI < 3; sI++) {
        drawStar(ctx, x + cw / 2 + (sI - 1) * 18 * u, y + art + 33 * u, 7.5 * u, sI < p.stars);
      }
      if (!open) {
        ctx.save();
        ctx.translate(x + cw / 2, y + art * 0.52);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = 'rgba(18,48,71,0.55)';
        ctx.lineWidth = 3 * u;
        ctx.beginPath(); ctx.arc(0, -6 * u, 7 * u, Math.PI, 0); ctx.stroke();
        roundRectPath(ctx, -11 * u, -6 * u, 22 * u, 17 * u, 4 * u);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      this.hits.push({
        id: `level:${i}`,
        x: this.w / 2 + (x - this.w / 2) * squeeze,
        y: listTop + (y - listTop) * squeeze,
        w: cw * squeeze, h: chh * squeeze,
      });
    });
    ctx.restore();
    ctx.textAlign = 'left';
  }

  /** A stamp on each level card that says what the level is, without a word in it. */
  private levelArt(i: number, x: number, y: number, cw: number, art: number, open: boolean): void {
    const ctx = this.ctx, u = this.u();
    const cx = x + cw / 2, cy = y + art * 0.55;
    ctx.save();
    ctx.globalAlpha = open ? 1 : 0.4;
    const L = LEVELS[i];
    const s = Math.min(art * 0.34, cw * 0.14);
    if (L.kind === 'tap') {
      const n = L.sig === '3/4' ? 3 : 4;
      for (let k = 0; k < n; k++) {
        const bx = cx + (k - (n - 1) / 2) * s * 1.5;
        const big = k === 0;
        ctx.fillStyle = big ? '#e05a4b' : '#4a8ed6';
        const bh = big ? s * 1.5 : s;
        roundRectPath(ctx, bx - s * 0.45, cy - bh / 2, s * 0.9, bh, s * 0.28);
        ctx.fill();
      }
      if (L.id === 'longshort') {
        ctx.fillStyle = '#f0c73c';
        roundRectPath(ctx, cx - s * 2.6, cy + s * 1.1, s * 2.4, s * 0.55, s * 0.2);
        ctx.fill();
        roundRectPath(ctx, cx + s * 0.5, cy + s * 1.1, s * 0.9, s * 0.55, s * 0.2);
        ctx.fill();
      }
    } else if (L.kind === 'echo') {
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = (open ? 1 : 0.4) * (1 - k * 0.28);
        quaver(ctx, cx + (k - 1) * s * 1.4, cy - s * 0.2 + k * s * 0.2, s * 0.9, ['#e05a4b', '#38b6ad', '#9a6ccd'][k]);
      }
    } else if (L.kind === 'pitch') {
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = ['#4a8ed6', '#38b6ad', '#6fbe5a', '#f0c73c'][k];
        roundRectPath(ctx, cx - s * 1.8 + k * s * 0.95, cy + s - k * s * 0.5, s * 0.75, s * 0.42, s * 0.16);
        ctx.fill();
      }
    } else if (L.kind === 'tune') {
      ctx.strokeStyle = 'rgba(18,48,71,0.35)';
      ctx.lineWidth = Math.max(1, s * 0.1);
      for (let k = 0; k < 3; k++) {
        const ly = cy - s * 0.7 + k * s * 0.7;
        ctx.beginPath(); ctx.moveTo(cx - s * 2, ly); ctx.lineTo(cx + s * 2, ly); ctx.stroke();
      }
      quaver(ctx, cx - s * 1.1, cy - s * 0.35, s * 0.8, '#e05a4b');
      quaver(ctx, cx + s * 1.1, cy + s * 0.35, s * 0.8, '#4a8ed6');
      ctx.setLineDash([s * 0.25, s * 0.2]);
      ctx.strokeStyle = '#6fbe5a';
      ctx.lineWidth = Math.max(1.5, s * 0.16);
      roundRectPath(ctx, cx - s * 0.4, cy - s * 0.9, s * 0.8, s * 1.7, s * 0.2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (L.kind === 'together') {
      ctx.fillStyle = '#b57b34';
      ctx.beginPath(); ctx.ellipse(cx - s * 1.1, cy + s * 0.3, s * 1.1, s * 0.85, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f6e7cc';
      ctx.beginPath(); ctx.ellipse(cx - s * 1.1, cy + s * 0.1, s * 0.95, s * 0.7, 0, 0, TAU); ctx.fill();
      quaver(ctx, cx + s * 1.2, cy - s * 0.3, s * 1, '#38b6ad');
    } else {
      for (let sI = 0; sI < 4; sI++) {
        for (let p = 0; p < 3; p++) {
          const on = (sI + p) % 3 === 0;
          ctx.fillStyle = on ? ['#e05a4b', '#f0c73c', '#38b6ad'][p] : 'rgba(18,48,71,0.14)';
          roundRectPath(ctx, cx - s * 2 + sI * s, cy - s * 1.1 + p * s * 0.8, s * 0.8, s * 0.6, s * 0.18);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // ---- the level itself

  private drawPlay(): void {
    const L = this.layout();
    if (this.level.kind === 'make') { this.drawSequencer(L); return; }
    this.drawPrompt(L.prompt);
    if (this.level.kind === 'pitch' && this.round.pair?.exact) {
      // the ladder is both the picture and the thing you press, so it gets the whole screen and
      // there is no second row of chimes underneath asking the same question again
      this.drawLadder({ x: L.stage.x, y: L.stage.y, w: L.stage.w, h: L.keys.y + L.keys.h - L.stage.y });
    } else {
      this.drawTimeline(L.stage);
      if (this.level.kind === 'tap' || this.level.kind === 'together') this.drawDrum(L.keys);
      else if (this.level.kind === 'pitch') this.drawWays(L.keys);
      else this.drawChimes(L.keys, {});
    }
    this.ps.draw(this.ctx);
  }

  private drawPrompt(r: Rect): void {
    const ctx = this.ctx, u = this.u();
    glassPanel(ctx, r.x, r.y, r.w, r.h, 16 * u, 0.93);
    ctx.textAlign = 'center';
    const cx = r.x + r.w / 2;
    const k = this.level.kind;
    let line = '';
    if (this.step === 'count') line = T('Get ready…', 'Klaarmaken…');
    else if (this.step === 'judge') {
      // the moment after the answer says how it went, whatever kind of level it is
      if (k === 'tap' || k === 'together') line = this.clean ? T('On the beat.', 'Op de tel.') : this.lateOrEarly();
      else if (this.noteT > 0) line = this.note;
      else line = this.clean
        ? T('That is it. Well listened.', 'Dat is hem. Goed geluisterd.')
        : T('Not quite - the game played the right one after yours.',
          'Net niet - het spel speelde de goede erachteraan.');
    } else if (this.noteT > 0) line = this.note;
    else if (k === 'echo') {
      line = this.step === 'listen' ? T('Listen.', 'Luister.') : T('Now you play it back.', 'Nu speel jij het na.');
    } else if (k === 'tune') {
      const name = this.round.tune ? (NL() ? this.round.tune.nameNl : this.round.tune.name) : '';
      line = this.step === 'listen' ? name : T('Which chime fills the gap?', 'Welk klokje hoort in het gat?');
    } else if (k === 'pitch') {
      line = this.step === 'listen' ? T('Listen.', 'Luister.') : (NL() ? this.round.sayNl : this.round.say);
    } else if (k === 'together') {
      line = T('Keep the drum going.', 'Hou de trom aan de gang.');
    } else line = T('Tap with the beat.', 'Tik mee met de tel.');

    // listening again is free: an ear is trained by hearing a thing twice, not by being marked down
    const needsAgain = (this.level.kind === 'echo' || this.level.kind === 'tune' || this.level.kind === 'pitch')
      && this.step === 'answer';
    const counting = this.step === 'count';
    const bw = 78 * u, bh = 38 * u;
    const hasButton = needsAgain || this.step === 'judge' || counting;
    // the words move over to make room for the button rather than running underneath it
    const textW = r.w - (hasButton ? bw + 26 * u : 28 * u);
    ctx.fillStyle = '#123047';
    ctx.font = this.font('800', 12.5);
    this.wrapText(line, r.x + 14 * u + textW / 2, r.y + r.h / 2 + 4 * u, textW, 14.5 * u, 3);
    void cx;
    if (counting) {
      // the count-in, in the slot the buttons use, where there is always room for it: on a
      // landscape phone the strip above the drum is not tall enough to hold a big figure
      const per = beatsPerBar(this.round.sig);
      const left = Math.max(1, Math.min(per, Math.ceil(-this.beatPos())));
      ctx.textAlign = 'center';
      outlinedText(ctx, `${left}`, r.x + r.w - bw / 2 - 8 * u, r.y + r.h / 2 + 11 * u,
        this.font('900', 27), '#123047', 'rgba(255,255,255,0.95)', 5);
      ctx.textAlign = 'left';
    } else if (needsAgain) {
      this.button('again', T('Again', 'Nog eens'), r.x + r.w - bw - 8 * u, r.y + (r.h - bh) / 2, bw, bh, '#f0b653', '#40260a');
    } else if (this.step === 'judge') {
      this.button('go', T('Next', 'Verder'), r.x + r.w - bw - 8 * u, r.y + (r.h - bh) / 2, bw, bh, '#4fae6e', '#ffffff');
    }
  }

  /**
   * The timeline: the bar laid out end to end, with the playhead on the audio clock.
   *
   * Everything a level has to say about time is said here - where the beats are, how long each
   * note is, where the count starts again, where a tap landed and where it should have been. The
   * playhead is `beatPos()`, so it is the audio clock drawn, not a second clock running beside it.
   */
  private drawTimeline(r: Rect): void {
    const ctx = this.ctx, u = this.u();
    const per = beatsPerBar(this.round.sig);
    const total = Math.max(1, this.endBeat);
    const inset = 22 * u;
    const x0 = r.x + inset, x1 = r.x + r.w - inset;
    const span = x1 - x0;
    const atBeat = (b: number): number => x0 + (b / total) * span;
    // the strip is as tall as it needs to be and sits in the middle of whatever it is given,
    // rather than being a great empty box with a thin line along the bottom of it
    const bounces = this.level.kind === 'tap' || this.level.kind === 'together';
    const wantH = (bounces ? 206 : 124) * u;
    const boxH = Math.min(r.h, wantH);
    // a shade above the middle, so the drum or the chimes below are not crowded
    const boxY = r.y + (r.h - boxH) * 0.42;
    const rowH = Math.min(34 * u, boxH * 0.22);
    const lineY = boxY + boxH - 40 * u;
    const pos = this.beatPos();

    glassPanel(ctx, r.x, boxY, r.w, boxH, 16 * u, 0.16);

    // during the replay, the bar being gone over is lit and the rest of the strip is left alone
    if (this.step === 'teach') {
      ctx.fillStyle = 'rgba(255, 244, 210, 0.14)';
      const tx = atBeat(this.teachFrom);
      roundRectPath(ctx, tx, boxY + 6 * u, atBeat(this.teachFrom + this.teachLen) - tx, boxH - 12 * u, 10 * u);
      ctx.fill();
    }

    // the bar lines, and the count under each beat
    for (let b = 0; b <= total; b++) {
      const x = atBeat(b);
      const one = b % per === 0;
      ctx.strokeStyle = one ? 'rgba(255, 246, 214, 0.85)' : 'rgba(255, 246, 214, 0.28)';
      ctx.lineWidth = one ? Math.max(1.6, 2.4 * u) : 1;
      ctx.beginPath();
      ctx.moveTo(x, lineY - rowH * 1.55);
      ctx.lineTo(x, lineY + (one ? 13 * u : 8 * u));
      ctx.stroke();
      if (b < total) {
        const n = (b % per) + 1;
        ctx.fillStyle = one ? 'rgba(255, 246, 214, 0.95)' : 'rgba(255, 246, 214, 0.5)';
        ctx.font = this.font('900', one ? 15 : 11);
        ctx.textAlign = 'center';
        ctx.fillText(`${n}`, atBeat(b + 0.5), lineY + 29 * u);
      }
    }
    ctx.strokeStyle = 'rgba(255, 246, 214, 0.5)';
    ctx.lineWidth = Math.max(1.4, 2 * u);
    ctx.beginPath(); ctx.moveTo(x0, lineY); ctx.lineTo(x1, lineY); ctx.stroke();

    // the notes, long ones long and short ones short
    this.round.sounds.forEach((s, i) => {
      const bx = atBeat(s.beat);
      const bw = Math.max(6 * u, (s.beats / total) * span - 3 * u);
      const lit = clamp(1 - (pos - s.beat) / 0.6, 0, 1) * (pos >= s.beat ? 1 : 0);
      const blank = this.round.blanks.includes(i) && this.level.kind === 'tune';
      const y = lineY - rowH * 1.3;
      // in the echo levels each block is one note of the answer, so it can say how it went
      const echoed = this.level.kind === 'echo' && i < this.answered.length
        ? (this.answered[i] === this.round.answer[i] ? 'right' : 'wrong') : null;
      if (s.midi === null) {
        ctx.fillStyle = `rgba(255, 246, 214, ${0.3 + lit * 0.6})`;
        ctx.beginPath(); ctx.arc(bx + 4 * u, y + rowH / 2, Math.max(3, 4.5 * u), 0, TAU); ctx.fill();
      } else {
        // a block only wears its pitch colour once the pitch is no longer the question
        const hidden = this.blindLevel() && echoed === null
          && !(this.level.kind === 'pitch' && this.picked !== null);
        noteBlock(ctx, bx, y, bw, rowH,
          echoed === 'right' ? '#4fae6e' : echoed === 'wrong' ? '#e0664a'
            : hidden ? '#cbd8e0' : colourOf(s.midi),
          lit, { open: blank && !this.filledAt(i), strong: s.stress === 'strong' });
        if (blank && this.filledAt(i)) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = this.font('900', 10);
          ctx.textAlign = 'center';
          ctx.fillText(letterOfMidi(s.midi), bx + bw / 2, y + rowH * 0.68);
        }
      }
    });

    // the beats the child is asked for
    this.round.asks.forEach((b, i) => {
      const x = atBeat(b);
      const g = this.got[i];
      const col = g === null ? 'rgba(255, 246, 214, 0.55)'
        : g === 'perfect' ? '#8ee6a8' : g === 'good' ? '#c6e88a' : g === 'ok' ? '#f0c73c' : '#e0664a';
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(2, 3 * u);
      ctx.beginPath(); ctx.arc(x, lineY, 9.5 * u, 0, TAU); ctx.stroke();
      if (g !== null && g !== 'miss') { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, lineY, 4 * u, 0, TAU); ctx.fill(); }
    });

    // what the child actually did, and the gap back to where it belonged
    for (const tap of this.taps) {
      const x = atBeat(clamp(tap.beat, -0.4, total + 0.4));
      const ring = tapTightness(tap.deltaMs);
      const col = tap.grade === 'perfect' ? '#8ee6a8' : tap.grade === 'good' ? '#c6e88a'
        : tap.grade === 'ok' ? '#f0c73c' : '#e0664a';
      if (tap.askIndex !== null && tap.grade !== 'perfect') {
        const tx = atBeat(this.round.asks[tap.askIndex]);
        ctx.strokeStyle = hexA(col, 0.7);
        ctx.lineWidth = Math.max(1.4, 2 * u);
        ctx.setLineDash([3 * u, 3 * u]);
        ctx.beginPath(); ctx.moveTo(x, lineY + 15 * u); ctx.lineTo(tx, lineY + 15 * u); ctx.stroke();
        ctx.setLineDash([]);
      }
      tapRing(ctx, x, lineY, 16 * u, ring, col, 1);
    }

    // the ball, and the playhead
    if (this.step !== 'judge') {
      const px = atBeat(clamp(pos, 0, total));
      if (this.step === 'run' || this.step === 'teach') {
        ctx.strokeStyle = 'rgba(255, 246, 214, 0.9)';
        ctx.lineWidth = Math.max(1.4, 2 * u);
        ctx.beginPath(); ctx.moveTo(px, lineY - rowH * 1.8); ctx.lineTo(px, lineY + 15 * u); ctx.stroke();
      }
      if (bounces || this.step === 'count') {
        // during the count-in the ball hops on the spot at the start of the bar, so a child can
        // see the tempo before the first note rather than having to guess it
        const br = Math.max(10, 13 * u);
        const bx = clamp(this.step === 'count' ? atBeat(0) : px, x0, x1);
        // the top of the hop has to stay inside the strip, which on a short landscape screen is
        // only a hundred pixels tall
        const rise = Math.max(14 * u, Math.min(52 * u, lineY - boxY - br - 8 * u));
        ctx.save();
        if (this.step === 'count') ctx.globalAlpha = 0.62;
        bounceBall(ctx, bx, lineY, rise, pos, br, '#f0c73c');
        ctx.restore();
      }
    }

    ctx.textAlign = 'left';
  }

  /**
   * Which way it went wrong, in the two words that are any use: too early, or too late.
   *
   * The rings on the timeline already say how close each tap was and where the beat actually
   * was. This says the one thing a ring cannot: which side of it you were on.
   */
  private lateOrEarly(): string {
    const missed = this.got.filter(g => g === null || g === 'miss').length;
    if (missed > 0 && missed === this.got.length) return T('Nothing landed. Watch the ball.', 'Er kwam niets aan. Kijk naar de bal.');
    const off = this.taps.filter(t => t.askIndex !== null && t.grade !== 'perfect');
    const late = off.filter(t => tapSide(t.deltaMs) === 'late').length;
    const early = off.filter(t => tapSide(t.deltaMs) === 'early').length;
    if (missed > 0) return T('One got away. The rings show where they were.', 'Er ontsnapte er een. De ringen laten zien waar ze zaten.');
    if (late > early) return T('A little late. Tap sooner.', 'Iets te laat. Tik wat eerder.');
    if (early > late) return T('A little early. Wait for the bounce.', 'Iets te vroeg. Wacht op de stuiter.');
    return T('Nearly. Listen once more.', 'Bijna. Luister nog eens.');
  }

  private filledAt(i: number): boolean {
    const k = this.round.blanks.indexOf(i);
    return k >= 0 && k < this.answered.length;
  }

  /** The ladder of pitches, for the second half of High and low. */
  private drawLadder(r: Rect): void {
    const ctx = this.ctx, u = this.u();
    const pair = this.round.pair;
    if (!pair) return;
    const n = CHIME_MIDI.length;
    const gap = Math.max(2, 4 * u);
    const rh = Math.min(48 * u, (r.h - gap * (n - 1)) / n);
    const used = rh * n + gap * (n - 1);
    const y0 = r.y + (r.h - used) / 2;
    const maxW = Math.min(r.w * 0.86, 300 * u);
    for (let i = n - 1; i >= 0; i--) {
      const k = i / (n - 1);
      const rw = maxW * (0.5 + (1 - k) * 0.5);
      const x = r.x + (r.w - rw) / 2;
      const y = y0 + (n - 1 - i) * (rh + gap);
      const midi = CHIME_MIDI[i];
      const isFirst = midi === pair.a;
      const isRight = midi === pair.b;
      let state: 'idle' | 'first' | 'right' | 'wrong' | 'press' = 'idle';
      if (this.picked !== null) {
        if (isRight) state = 'right';
        else if (this.picked === i) state = 'wrong';
        else if (isFirst) state = 'first';
      } else if (isFirst) state = 'first';
      if (this.held0 === `rung:${i}`) state = 'press';
      rung(ctx, x, y, rw, rh, midi, state);
      if (isFirst) {
        ctx.fillStyle = 'rgba(255, 250, 235, 0.95)';
        ctx.font = this.font('900', 10.5);
        ctx.textAlign = 'right';
        ctx.fillText(T('first note', 'eerste noot'), x + rw - 10 * u, y + rh * 0.66, rw * 0.7);
        ctx.textAlign = 'left';
      }
      if (this.picked === null) this.hits.push({ id: `rung:${i}`, x, y, w: rw, h: rh });
    }
    ctx.textAlign = 'left';
  }

  /** Higher or lower: two big buttons and nothing else on the screen. */
  private drawWays(r: Rect): void {
    const u = this.u();
    const bw = Math.min(150 * u, (r.w - 14 * u) / 2);
    const bh = Math.min(94 * u, r.h * 0.74);
    const y = r.y + (r.h - bh) / 2;
    const pair = this.round.pair;
    const right = pair ? pair.b > pair.a : true;
    const tone = (mine: boolean): string => {
      if (this.picked === null) return '#fff8ea';
      if (mine === right) return '#4fae6e';
      return this.picked === (mine ? 1 : 0) ? '#e0664a' : '#fff8ea';
    };
    const ink = (mine: boolean): string => (this.picked !== null && (mine === right || this.picked === (mine ? 1 : 0)) ? '#ffffff' : '#25506e');
    this.button('higher', T('Higher', 'Hoger'), r.x + r.w / 2 - bw - 7 * u, y, bw, bh, tone(true), ink(true));
    this.button('lower', T('Lower', 'Lager'), r.x + r.w / 2 + 7 * u, y, bw, bh, tone(false), ink(false));
  }

  /** The drum the tapping levels are played on. */
  private drawDrum(r: Rect): void {
    const ctx = this.ctx, u = this.u();
    const rx = Math.min(r.w * 0.42, 210 * u);
    const ry = Math.min(r.h * 0.42, rx * 0.6);
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.5;
    drumPad(ctx, cx, cy, rx, ry, this.hitFlash, this.held0 === 'pad');
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(70, 44, 20, 0.5)';
    ctx.font = this.font('900', 14);
    ctx.fillText(T('tap here', 'tik hier'), cx, cy + ry * 0.14);
    ctx.textAlign = 'left';
    this.hits.push({ id: 'pad', x: r.x, y: r.y, w: r.w, h: r.h });
  }

  /** The nine chimes. The same drawing on the opening screen and inside a level. */
  private drawChimes(r: Rect, o: { free?: boolean }): void {
    const ctx = this.ctx;
    const rects = this.chimeRects(r);
    const now = audioNow();
    chimeStand(ctx, r.x, r.y, r.w, r.h);
    // the bar the game is pointing at: the note that should have been played, or the rung that
    // was the right answer
    const wantMidi = this.level.kind === 'pitch'
      ? (this.picked !== null ? this.round.pair?.b ?? -1 : -1)
      : (this.wrongAt >= 0 && this.wrongAt === this.answered.length - 1 ? this.round.answer[this.wrongAt] : -1);
    const crossMidi = this.wrongAt >= 0 && this.wrongAt === this.answered.length - 1 ? this.wrongMidi : -1;
    rects.forEach((b, i) => {
      const midi = CHIME_MIDI[i];
      // a bar scheduled but not yet sounded must not light early, so the age is allowed to be
      // negative and nothing happens until it is not
      const age = now - this.struck[i];
      const glow = age < 0 ? 0 : clamp(1 - age / 0.55, 0, 1);
      chimeBar(ctx, b.x, b.y, b.w, b.h, {
        midi, glow,
        pressed: this.held0 === `chime:${i}`,
        point: midi === wantMidi && midi !== crossMidi,
        cross: midi === crossMidi,
        dim: this.round.pool.length > 0 && !this.round.pool.includes(midi),
      });
      // the card at the end of a level covers the room; nothing behind it takes a tap
      if (this.phase !== 'won') this.hits.push({ id: `chime:${i}`, x: b.x, y: r.y, w: b.w, h: r.h });
    });
    // the pointing hand goes away the moment a bar has actually been hit
    if (o.free && !this.struck.some(t => t > 0)) {
      const b = rects[3];
      ctx.save();
      ctx.globalAlpha = 0.45 + breathe(this.t, 2.6) * 0.4;
      handCursor(ctx, b.x + b.w / 2 + 8 * this.u(), b.y + b.h * 0.5, 14 * this.u(), breathe(this.t, 2.6));
      ctx.restore();
    }
  }

  // ---- the sequencer

  private drawSequencer(L: Layout): void {
    const ctx = this.ctx, u = this.u();
    const pad = Math.max(10, 13 * u);
    const barY = 62 * u;
    const bh = 44 * u;
    const gap = 7 * u;
    const n = 4;
    const bw = Math.min(120 * u, (this.w - pad * 2 - gap * (n - 1)) / n);
    const x0 = this.w / 2 - (bw * n + gap * (n - 1)) / 2;
    this.button('play', this.seqOn ? T('Stop', 'Stop') : T('Play', 'Spelen'),
      x0, barY, bw, bh, this.seqOn ? '#e0664a' : '#4fae6e', '#ffffff');
    this.button('voice', NL() ? voiceById(this.voice).nameNl : voiceById(this.voice).name,
      x0 + (bw + gap), barY, bw, bh, '#f0b653', '#40260a');
    this.button('tempo', `${this.seqBpm}`, x0 + (bw + gap) * 2, barY, bw, bh, '#4a8ed6', '#ffffff');
    this.button('clear', T('Clear', 'Leeg'), x0 + (bw + gap) * 3, barY, bw, bh, '#fff8ea', '#25506e');

    // one strip of text above the grid, always reserved, so nothing the game says ever lands on
    // top of a square a child is aiming at
    const msgY = barY + bh + 17 * u;
    const top = msgY + 22 * u;
    const bottom = this.h - 12 * u;
    const availH = bottom - top;
    // the left-hand gutter carries the colour of each row, because an empty grid has no other
    // way of saying which line is which note
    const gutter = 14 * u;
    const availW = this.w - pad * 2 - gutter;
    const cg = Math.max(2, 3 * u);
    const cw = Math.min(72 * u, (availW - cg * (SEQ_STEPS - 1)) / SEQ_STEPS);
    const ch = Math.min(68 * u, cw * 1.5, (availH - cg * (SEQ_PITCHES - 1)) / SEQ_PITCHES);
    const gw = cw * SEQ_STEPS + cg * (SEQ_STEPS - 1);
    const gh = ch * SEQ_PITCHES + cg * (SEQ_PITCHES - 1);
    const gx = (this.w - (gutter + gw)) / 2 + gutter;
    const gy = top + (availH - gh) / 2;
    const head = this.seqOn ? this.seqPos() : -1;

    // One board under the whole grid. The room behind it goes from wall to table halfway down, and
    // an empty square that sits on the wall does not look like an empty square that sits on the
    // table - so the same square read as two different things depending on where it was.
    ctx.fillStyle = 'rgba(16, 32, 50, 0.78)';
    roundRectPath(ctx, gx - gutter - 6 * u, gy - 8 * u, gutter + gw + 12 * u, gh + 16 * u, 14 * u);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 246, 214, 0.18)';
    ctx.lineWidth = Math.max(1, 1.4 * u);
    roundRectPath(ctx, gx - gutter - 6 * u, gy - 8 * u, gutter + gw + 12 * u, gh + 16 * u, 14 * u);
    ctx.stroke();

    // the ladder of colours down the left: low at the bottom, the way the chimes are laid out
    for (let p = 0; p < SEQ_PITCHES; p++) {
      const row = SEQ_PITCHES - 1 - p;
      const y = gy + row * (ch + cg);
      ctx.fillStyle = colourOf(CHIME_MIDI[p]);
      roundRectPath(ctx, gx - gutter, y + ch * 0.2, gutter * 0.45, ch * 0.6, gutter * 0.22);
      ctx.fill();
    }

    // the column the loop is on, behind the squares
    if (head >= 0) {
      ctx.fillStyle = 'rgba(255, 244, 210, 0.16)';
      roundRectPath(ctx, gx + head * (cw + cg) - cg / 2, gy - 6 * u, cw + cg, gh + 12 * u, 8 * u);
      ctx.fill();
    }
    for (let s = 0; s < SEQ_STEPS; s++) {
      for (let p = 0; p < SEQ_PITCHES; p++) {
        // the low chimes at the bottom, the way they are on the instrument
        const row = SEQ_PITCHES - 1 - p;
        const x = gx + s * (cw + cg);
        const y = gy + row * (ch + cg);
        const lit = head === s && this.grid[s][p] ? 1 : 0;
        gridCell(ctx, x, y, cw, ch, CHIME_MIDI[p], this.grid[s][p], head === s, lit);
        this.hits.push({ id: `cell:${s},${p}`, x, y, w: cw, h: ch });
      }
    }
    // the bar line down the middle: eight steps is two bars of four
    ctx.strokeStyle = 'rgba(255, 246, 214, 0.35)';
    ctx.lineWidth = Math.max(1, 1.6 * u);
    const mid = gx + 4 * (cw + cg) - cg / 2;
    ctx.beginPath(); ctx.moveTo(mid, gy - 4 * u); ctx.lineTo(mid, gy + gh + 4 * u); ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = this.font('800', 11.5);
    ctx.save();
    const msg = this.noteT > 0 ? this.note
      : gridNoteCount(this.grid) === 0
        ? T('Tap the squares. Higher up is a higher note.', 'Tik op de vakjes. Hoger is een hogere noot.')
        : T('Press play and it goes round and round.', 'Druk op spelen en het gaat rond.');
    if (this.noteT > 0) { ctx.globalAlpha = clamp(this.noteT, 0, 1); ctx.fillStyle = '#ffe9a8'; }
    else ctx.fillStyle = 'rgba(255, 246, 214, 0.82)';
    this.wrapText(msg, this.w / 2, msgY + 4 * u, this.w - pad * 2 - 20 * u, 13 * u, 2);
    ctx.restore();
    ctx.textAlign = 'left';
  }

  // ---- the furniture

  private drawChrome(): void {
    const ctx = this.ctx, u = this.u();
    if (this.phase !== 'play') return;
    this.button('levels', T('Levels', 'Niveaus'), 13 * u, 12 * u, 88 * u, 42 * u, '#fff8ea', '#25506e');
    if (this.level.kind === 'make') return;

    // the level's name and how far through it you are, both kept clear of the two round buttons
    // in the corner, which sit over the canvas on every page in Suri
    const lx = 13 * u + 88 * u + 12 * u;
    const room = this.w - 106 * u - lx;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 246, 214, 0.92)';
    ctx.font = this.font('900', 12);
    ctx.fillText(nameOf(this.level), lx, 25 * u, Math.max(20, room));
    const n = Math.max(1, this.level.rounds);
    const dot = 4.5 * u, gap = 5 * u;
    for (let i = 0; i < n; i++) {
      const done = i < this.roundNo;
      ctx.fillStyle = done ? 'rgba(143, 224, 160, 0.95)' : i === this.roundNo ? 'rgba(255,246,214,0.75)' : 'rgba(255,246,214,0.3)';
      ctx.beginPath();
      ctx.arc(lx + dot + i * (dot * 2 + gap), 42 * u, dot * (i === this.roundNo ? 1.3 : 1), 0, TAU);
      ctx.fill();
    }
  }

  private button(id: string, label: string, x: number, y: number, w: number, h: number, tone = '#fff8ea', ink = '#25506e'): void {
    const ctx = this.ctx;
    const face = chunkyButton(ctx, x, y, w, h, { tone, pressed: this.held0 === id });
    ctx.fillStyle = ink;
    ctx.font = this.font('900', h > 50 * this.u() ? 15 : 12.5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x + w / 2, face.y + h * 0.63, w - 14);
    ctx.textAlign = 'left';
    this.hits.push({ id, x, y, w, h });
  }

  /**
   * Centre a heading, but never under the two round buttons in the top right corner.
   *
   * They are the same size on every page of Suri and they sit over the canvas, so the
   * canvas has to know they are there. The font must be set before this is called.
   */
  private headX(text: string): number {
    const u = this.u();
    const right = this.w - 106 * u;
    const half = this.ctx.measureText(text).width / 2;
    return Math.max(half + 10 * u, Math.min(this.w / 2, right - half));
  }

  /** A few lines at most, broken on spaces and centred on `cy`. A card is not a paragraph. */
  private wrapText(text: string, cx: number, cy: number, maxW: number, lh: number, maxLines: number): void {
    const ctx = this.ctx;
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = word; } else cur = test;
      if (lines.length === maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    const y0 = cy - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh, maxW));
  }

  private drawEnd(): void {
    const ctx = this.ctx, u = this.u();
    ctx.fillStyle = 'rgba(10, 24, 40, 0.55)';
    ctx.fillRect(0, 0, this.w, this.h);
    const pop = easeOutBack(clamp(this.cardPop, 0, 1));
    const cw = Math.min(340 * u, this.w - 30 * u);
    const ch = Math.min(272 * u, this.h - 34 * u);
    const x = this.w / 2 - cw / 2, y = this.h / 2 - ch / 2;
    ctx.save();
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-this.w / 2, -this.h / 2);
    glassPanel(ctx, x, y, cw, ch, 24 * u, 0.97);
    ctx.save();
    roundRectPath(ctx, x, y, cw, ch, 24 * u);
    ctx.clip();
    const band = ctx.createLinearGradient(0, y, 0, y + 84 * u);
    band.addColorStop(0, this.earned > 0 ? '#8fd6e8' : '#f0c78a');
    band.addColorStop(1, 'rgba(143, 214, 232, 0)');
    ctx.fillStyle = band;
    ctx.fillRect(x, y, cw, 84 * u);
    ctx.restore();
    ctx.textAlign = 'center';
    heading(ctx, nameOf(this.level), this.w / 2, y + 42 * u, this.font('900', 18), '#123047');
    for (let i = 0; i < 3; i++) {
      const shown = clamp(this.cardPop * 1.6 - i * 0.25, 0, 1);
      drawStar(ctx, this.w / 2 + (i - 1) * 40 * u, y + 86 * u, 17 * u, i < this.earned, i < this.earned ? easeOutBack(shown) : 1);
    }
    ctx.fillStyle = 'rgba(18,48,71,0.8)';
    ctx.font = this.font('800', 13);
    ctx.fillText(T(`${this.firstTry} of ${this.level.rounds} right first time`,
      `${this.firstTry} van de ${this.level.rounds} in één keer goed`), this.w / 2, y + 126 * u, cw - 36 * u);
    ctx.fillStyle = 'rgba(18,48,71,0.62)';
    ctx.font = this.font('700', 11.5);
    this.wrapText(this.earned === 3
      ? T('Every one on the beat, first go.', 'Allemaal in één keer op de tel.')
      : this.earned === 0
        ? T('It played each one back slowly. Have another go.', 'Het speelde ze steeds langzaam voor. Doe het nog eens.')
        : T('Good. The slow replays are the ones to listen to.', 'Goed. Let op de stukken die langzaam werden voorgespeeld.'),
    this.w / 2, y + 152 * u, cw - 40 * u, 14 * u, 2);
    ctx.restore();

    const bw = Math.min(134 * u, (cw - 28 * u) / 2), bh = 48 * u, by = y + ch - 66 * u;
    this.button('retry', T('Again', 'Opnieuw'), this.w / 2 - bw - 6 * u, by, bw, bh);
    if (this.levelIndex + 1 < LEVELS.length) {
      this.button('next', T('Next', 'Volgende'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
    } else {
      this.button('levels', T('All levels', 'Alle niveaus'), this.w / 2 + 6 * u, by, bw, bh, '#4fae6e', '#ffffff');
    }
    ctx.textAlign = 'left';
  }
}
