/**
 * The thing that shows a child what to do, without a word of explaining.
 *
 * Every game had the same problem and was about to grow its own answer to it: a line of text at
 * the top saying what to do, which is no use at all to a child who cannot read yet and not much
 * use to one who can. A child learns what a game is by watching someone do it once.
 *
 * So this is one coach for every game. A game hands it a short script - point here, a hand taps,
 * now you try - and the coach does the rest: it dims everything except the one place that matters,
 * draws a hand doing the gesture, waits, and then gets out of the way. No paragraphs, no "next"
 * buttons to read, nothing to dismiss. It runs once per game and never comes back uninvited.
 *
 * It also watches. A child who gets the same thing wrong three times, or who sits and does nothing
 * for a while, is a child who has lost the thread - and that, and only that, brings the hand back
 * for one beat. Help that arrives when you are not stuck is noise; help that arrives when you are
 * is the whole game.
 */

import {
  easeInOut, easeOutCubic, glassPanel, handCursor, hexA, roundRectPath, type Ctx,
} from '../render/look';

/** A place on the screen the coach can point at. Worked out at the moment it is needed. */
export type Spot = { x: number; y: number; r?: number } | { x: number; y: number; w: number; h: number };

/** One thing the coach shows. */
export interface Beat {
  /** the one line under it, in both languages; keep it to a handful of words */
  say: string;
  sayNl: string;
  /** what to light up. A function, because layouts move. */
  at?: () => Spot | null;
  /** where a demonstrated drag ends up */
  to?: () => Spot | null;
  /**
   * `watch` - the hand does it and the child watches.
   * `tap` / `drag` - the hand shows it once, then it waits for the child to do it for real.
   */
  act: 'watch' | 'tap' | 'drag';
  /** seconds to hold a `watch` beat before moving on */
  hold?: number;
}

const HAND_IN = 0.45;       // the hand takes this long to arrive
const TAP_AT = 0.75;        // and presses here, as a fraction of one loop
const LOOP = 2.1;           // seconds per demonstration loop

/** How long a child may be stuck before the hand comes back of its own accord. */
export const STUCK_SECONDS = 9;
export const STUCK_WRONGS = 3;

export class Coach {
  private beats: Beat[] = [];
  private i = 0;
  private t = 0;
  /** waiting for the child to copy what was just shown */
  private waiting = false;
  private done = true;
  /** the one-beat nudge, shown when a child is plainly stuck rather than at the start */
  private nudge: Beat | null = null;
  private nudgeT = 0;
  private idle = 0;
  private wrongs = 0;

  /** Is the coach on screen? A game should not act on taps while it is. */
  get busy(): boolean { return !this.done || this.nudge !== null; }
  /** Is it waiting for the child to do the thing for real? Then the game must let the tap through. */
  get listening(): boolean { return this.waiting && !this.done; }
  get beat(): Beat | null { return this.nudge ?? (this.done ? null : this.beats[this.i] ?? null); }

  /** Start a run. `already` is what the save says: a game only teaches itself once. */
  start(beats: Beat[], already: boolean): void {
    if (already || !beats.length) { this.done = true; this.beats = []; return; }
    this.beats = beats;
    this.i = 0; this.t = 0; this.waiting = false; this.done = false;
  }

  /** Give up on the lesson - the child has started playing, which is the point. */
  finish(): void { this.done = true; this.nudge = null; }

  /**
   * The child did the thing that was being shown.
   *
   * Returns true when that closes the lesson, so a game can save "this one has been taught".
   */
  did(): boolean {
    this.nudge = null;
    this.idle = 0; this.wrongs = 0;
    if (this.done) return false;
    this.i++;
    this.t = 0;
    this.waiting = false;
    if (this.i >= this.beats.length) { this.done = true; return true; }
    return false;
  }

  /** Something went wrong, or nothing happened. Enough of either brings the hand back. */
  trouble(kind: 'wrong' | 'idle', dt = 0): void {
    if (this.busy) return;
    if (kind === 'wrong') { this.wrongs++; this.idle = 0; }
    else this.idle += dt;
  }

  /** The game's own hint, offered only once the child is plainly stuck. */
  offer(beat: Beat | null): void {
    if (!beat || this.busy) return;
    if (this.wrongs < STUCK_WRONGS && this.idle < STUCK_SECONDS) return;
    this.nudge = beat;
    this.nudgeT = 0;
    this.wrongs = 0; this.idle = 0;
  }

  update(dt: number): void {
    if (this.nudge) {
      this.nudgeT += dt;
      if (this.nudgeT > LOOP * 2) this.nudge = null;
      return;
    }
    if (this.done) return;
    this.t += dt;
    const b = this.beats[this.i];
    if (!b) { this.done = true; return; }
    if (b.act === 'watch') {
      if (this.t > (b.hold ?? LOOP)) this.did();
      return;
    }
    // show it once, then hand over and wait for the child to copy it
    if (this.t > LOOP) this.waiting = true;
  }

  /**
   * Draw the lesson over the game.
   *
   * Everything but the one place that matters is dimmed, so there is nowhere else to look. The
   * cut-out is drawn as a hole in the scrim rather than as a ring on top of it, which is what
   * makes it read as "here, and nowhere else".
   */
  draw(ctx: Ctx, w: number, h: number, u: number, nl: boolean, font: (weight: string, size: number) => string): void {
    const b = this.beat;
    if (!b) return;
    const t = this.nudge ? this.nudgeT : this.t;
    const phase = (t % LOOP) / LOOP;
    const spot = b.at?.() ?? null;
    const dest = b.to?.() ?? null;
    const fade = Math.min(1, t * 3);

    ctx.save();
    ctx.globalAlpha = fade;

    // the scrim, with a hole in it where the child should be looking
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    if (spot) { holePath(ctx, spot, u); ctx.closePath(); }
    ctx.fillStyle = 'rgba(8, 18, 32, 0.52)';
    ctx.fill('evenodd');
    ctx.restore();

    if (spot) {
      // a soft ring round the hole, breathing, so it reads as alive rather than as a cut-out
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.4);
      ctx.strokeStyle = hexA('#ffd86b', 0.55 + pulse * 0.4);
      ctx.lineWidth = Math.max(2, 2.6 * u);
      ctx.beginPath();
      holePath(ctx, spot, u, 3 * u * pulse);
      ctx.stroke();
    }

    // the hand, doing the thing. Not on a `watch` beat: there the point is to look at the thing,
    // and a hand laid over it is the one object in the way.
    if (spot && b.act !== 'watch') {
      const from = centre(spot);
      const to = dest ? centre(dest) : from;
      const k = b.act === 'drag'
        ? easeInOut(Math.min(1, Math.max(0, (phase - HAND_IN) / (1 - HAND_IN))))
        : 0;
      const arrive = easeOutCubic(Math.min(1, phase / HAND_IN));
      const hx = from.x + (to.x - from.x) * k;
      const hy = from.y + (to.y - from.y) * k + (1 - arrive) * 26 * u;
      const press = b.act === 'tap'
        ? Math.max(0, 1 - Math.abs(phase - TAP_AT) * 9)
        : (k > 0 && k < 1 ? 1 : 0);
      ctx.globalAlpha = fade * (0.35 + 0.65 * arrive);
      if (b.act === 'drag' && dest) {
        // the road the hand takes, so the gesture is legible even before the hand gets there
        ctx.strokeStyle = hexA('#ffd86b', 0.5);
        ctx.lineWidth = Math.max(2, 2.4 * u);
        ctx.setLineDash([6 * u, 6 * u]);
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      handCursor(ctx, hx, hy, 24 * u, press);
      ctx.globalAlpha = fade;
    }

    // and the one line, at the end of the screen the hand is not on
    const words = nl ? b.sayNl : b.say;
    if (words) {
      ctx.font = font('900', 14);
      const tw = Math.min(w - 48 * u, ctx.measureText(words).width + 40 * u);
      const near = spot ? centre(spot).y : h / 2;
      const y = near > h * 0.5 ? h * 0.12 : h * 0.8;
      const x = w / 2 - tw / 2;
      glassPanel(ctx, x, y, tw, 44 * u, 16 * u, 0.95);
      ctx.fillStyle = '#12233b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(words, w / 2, y + 22 * u, tw - 24 * u);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
  }
}

const centre = (s: Spot): { x: number; y: number } =>
  'w' in s ? { x: s.x + s.w / 2, y: s.y + s.h / 2 } : { x: s.x, y: s.y };

function holePath(ctx: Ctx, s: Spot, u: number, grow = 0): void {
  if ('w' in s) {
    roundRectPath(ctx, s.x - grow, s.y - grow, s.w + grow * 2, s.h + grow * 2, 14 * u);
  } else {
    ctx.moveTo(s.x + (s.r ?? 40 * u) + grow, s.y);
    ctx.arc(s.x, s.y, (s.r ?? 40 * u) + grow, 0, Math.PI * 2);
  }
}
