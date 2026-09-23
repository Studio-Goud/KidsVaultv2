/**
 * Suri, in the corner of every game, for when you did not catch it.
 *
 * The instruction is spoken when it changes. That is not enough on its own: a child who was still
 * looking at the picture, or whose brother said something, has no way back to it. Every game
 * therefore carries the guide in the opposite corner from the way home, and tapping him repeats
 * the last thing he said.
 *
 * It is the same button in every game, in the same place, at the same size - like the way home -
 * so it is learnt once and never again. It is deliberately not a help menu, not a hint system and
 * not a progress marker: it says the line again, and that is all it does.
 */
import { drawGuide } from '../platform/guide';
import { say } from '../platform/voice';
import { NL } from '../util/lang';

export function addGuideButton(opts: { line: () => string }): void {
  const b = document.createElement('button');
  b.className = 'guidebtn';
  b.type = 'button';
  b.setAttribute('aria-label', NL() ? 'Zeg het nog eens' : 'Say that again');
  b.title = NL() ? 'Zeg het nog eens' : 'Say that again';

  const c = document.createElement('canvas');
  b.appendChild(c);
  document.body.appendChild(b);

  const ctx = c.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const SIDE = 46;
  c.width = SIDE * dpr; c.height = SIDE * dpr;

  /** he talks for a moment when tapped, so it is clear the tap did something */
  let talkUntil = 0;

  b.addEventListener('click', e => {
    e.preventDefault();
    const line = opts.line();
    if (!line) return;
    say(null, line);
    talkUntil = performance.now() + 1400;
  });

  if (ctx) {
    let t = 0;
    const paint = (): void => {
      t += 0.016;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, SIDE, SIDE);
      const talking = performance.now() < talkUntil;
      drawGuide(ctx, SIDE / 2, SIDE - 3, SIDE - 4, { pose: talking ? 'talk' : 'watch', t, saying: t });
      requestAnimationFrame(paint);
    };
    paint();
  }

  // He hides when there is nothing to repeat, rather than sitting there doing nothing when
  // pressed. A button that does nothing teaches a child to stop pressing buttons.
  const sync = (): void => { b.style.display = opts.line() ? 'grid' : 'none'; };
  sync();
  setInterval(sync, 400);
}
