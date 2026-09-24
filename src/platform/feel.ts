/**
 * Vibration: a tap you can feel, in every game and on every button.
 *
 * The owner asked for it. It already existed for Cloudhopper alone, through `navigator.vibrate`,
 * which an iPhone does not have - and the owner plays on an iPhone. So there are three ways in, the
 * best one the device offers first:
 *
 *  1. inside the app, Capacitor's Haptics plugin, which is the real Taptic Engine on iOS and the
 *     vibration motor on Android;
 *  2. in a browser on Android, `navigator.vibrate`;
 *  3. in Safari on an iPhone, which has no vibration API at all, a hidden switch control that iOS
 *     itself gives a small tick when it is flipped. That only works while the finger is on the
 *     glass, so a vibration that comes later (a level finishing after an animation) is not felt
 *     there - which is the right side to fail on.
 *
 * Every kind is short. A child's hand should feel that something happened, not be buzzed at, and a
 * mistake is two soft taps, never a long buzz: the same rule the sounds follow.
 */

import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { save } from '../util/storage';

export type Feel = 'tap' | 'light' | 'medium' | 'heavy' | 'good' | 'wrong' | 'done';

const PATTERN: Record<Feel, number | number[]> = {
  tap: 8,
  light: 12,
  medium: 22,
  heavy: [30, 40, 60],
  good: 18,
  wrong: [14, 60, 14],
  done: [16, 50, 16, 50, 28],
};

let last = 0;
let iosSwitch: HTMLLabelElement | null = null;

/** The hidden switch Safari ticks when it is flipped: the only haptic a web page on an iPhone gets. */
function safariTick(times: number): void {
  try {
    if (!iosSwitch) {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.id = 'suri-feel';
      const label = document.createElement('label');
      label.htmlFor = input.id;
      for (const el of [input, label]) {
        el.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
        el.setAttribute('aria-hidden', 'true');
        el.tabIndex = -1;
      }
      document.body.append(input, label);
      iosSwitch = label;
    }
    const lab = iosSwitch;
    for (let i = 0; i < times; i++) setTimeout(() => lab.click(), i * 70);
  } catch { /* no switch, no tick */ }
}

const isIOSWeb = (): boolean =>
  !Capacitor.isNativePlatform() && /iP(hone|ad|od)/.test(navigator.userAgent) && typeof navigator.vibrate !== 'function';

export function feel(kind: Feel): void {
  if (save.haptics === false) return;
  // a stroke of the brush fires many times a second; the hand needs one tick, not a hum
  const now = performance.now();
  if (now - last < 45) return;
  last = now;
  try {
    if (Capacitor.isNativePlatform()) {
      if (kind === 'wrong') void Haptics.notification({ type: NotificationType.Warning });
      else if (kind === 'done') void Haptics.notification({ type: NotificationType.Success });
      else void Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' || kind === 'good' ? ImpactStyle.Medium : ImpactStyle.Light });
      return;
    }
    if (typeof navigator.vibrate === 'function') { navigator.vibrate(PATTERN[kind]); return; }
    if (isIOSWeb()) safariTick(kind === 'wrong' ? 2 : kind === 'done' ? 3 : 1);
  } catch { /* a device that cannot vibrate simply does not */ }
}

/**
 * What a sound should feel like, from the name of the sound. Every game names its sounds the same
 * way - `tap`, `right`, `wrong`, `complete` - so one table gives all sixteen games vibration
 * without touching any of them. A sound that is scenery (water, wind, a creaking wheel) is not felt.
 */
export function feelFor(name: string): Feel | null {
  if (/^(complete|solved|done|record|fanfare|roundDone|wheelDone|landed|tenFull|fieldFull)$/.test(name)) return 'done';
  if (/^(wrong|miss|missed|blocked|fail|puzzled|crack|bounce|blow|flat|dry|knocked|shellLost|nudge|tired|crash|warn)$/.test(name)) return 'wrong';
  if (/^(right|correct|snap|land|word|line|lock|uncover|pickup|glow|coins|bell|happy|place|arrive|cheer|pop|ignite|stage|chop|drop|clunk|touchdown|coin)$/.test(name)) return 'good';
  if (/^(tap|uiTap|pick|lift|click|key|toggle|stepper|tab|hold|index|open|home|back|page|surprise|take|dig|pot|mole|more|on|go|pathStart|pathLock|peek|undo|chisel|hammer|pick)$/.test(name)) return 'tap';
  return null;
}
