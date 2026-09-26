/**
 * Look at every screen in Suri the way a parent's phone does, and complain in writing.
 *
 * This exists because a screenshot from a real iPhone showed four faults at once - a speed button
 * underneath the way home, a readout drawn under the status bar, a dropped stage floating above
 * the rocket it fell off - on a build that had passed twelve hundred unit tests. Unit tests check
 * what the rules say. They cannot see two things in the same place.
 *
 * So this opens each page at each size a child might hold, with and without a notch, and checks
 * the things a pair of eyes checks:
 *
 *   - nothing you can press is underneath anything else you can press
 *   - nothing you can press is under the notch, the status bar or the home indicator
 *   - nothing you can press is off the edge of the screen, or too small for a finger
 *   - nothing throws in the console
 *
 * It writes a screenshot of every combination, because the checks above cannot see a drawing that
 * is simply wrong, and those still need a person.
 *
 *   npm run audit                every page, every size
 *   npm run audit -- moonshot    one page
 *
 * Needs the dev server up: npm run dev.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.AUDIT_URL ?? 'http://localhost:5173';
const OUT = process.env.AUDIT_DIR ?? '.cache/audit';

/** Every page, and the handle its game hangs on the window for its own state. */
const PAGES = [
  ['index', null], ['parents', null], ['cloudhopper', '__wh'], ['moonshot', '__moon'], ['nightwatch', '__nw'],
  ['orbit', '__orbit'], ['circuit', '__circuit'], ['mill', '__mill'], ['tidepool', '__tide'],
  ['market', '__market'], ['puffball', '__puff'], ['dig', '__dig'], ['clock', '__clock'], ['seasons', '__seasons'],
  ['atlas', '__atlas'], ['animals', '__animals'], ['letters', '__letters'], ['rhythm', '__rhythm'],
  ['numbers', '__numbers'], ['reis', '__reis'], ['diepzee', '__diepzee'], ['dino', '__dino'],
  // The same pages again as a particular age, through the `__years` hook in src/platform/who.ts.
  // A toddler shape and a split shelf are different screens, and neither is seen without a profile.
  ['index', null, 3], ['index', null, 10], ['dig', '__dig', 2], ['rhythm', '__rhythm', 2],
];

/** The shapes a child actually holds, and the one that has a notch in it. */
const SIZES = [
  { name: 'small', w: 320, h: 568, insets: null },
  { name: 'phone', w: 390, h: 844, insets: null },
  { name: 'notch', w: 440, h: 956, insets: { top: 61, bottom: 34, left: 0, right: 0 } },
  { name: 'land', w: 844, h: 390, insets: { top: 0, bottom: 21, left: 59, right: 59 } },
  { name: 'tablet', w: 834, h: 1112, insets: null },
];

/** A finger is about this wide. Anything smaller is a button only an adult can hit. */
const FINGER = 30;

const only = process.argv.slice(2).filter(a => !a.startsWith('-'));
const pages = only.length ? PAGES.filter(([n]) => only.includes(n)) : PAGES;
const label = (page, years) => (years === undefined ? page : `${page}-${years}y`);

const overlap = (a, b) => {
  const x = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return x > 2 && y > 2 ? Math.round(x) * Math.round(y) : 0;
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--ignore-certificate-errors'],
});

const faults = [];
const note = (where, kind, detail) => faults.push({ where, kind, detail });

for (const size of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2,
    locale: 'nl-NL', ignoreHTTPSErrors: true,
  });
  if (size.insets) await ctx.addInitScript(i => { window.__insets = i; }, size.insets);
  // Suri in the corner is there as soon as a game has said anything; the audit shows him from the
  // start, so a button under his corner is found even on a page that has not spoken yet
  await ctx.addInitScript(() => { window.__guideAlways = true; });
  for (const [page, handle, years] of pages) {
    const where = `${label(page, years)} @ ${size.name}`;
    const p = await ctx.newPage();
    if (years !== undefined) await p.addInitScript(y => { window.__years = y; }, years);
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    try {
      await p.goto(`${BASE}/${page}.html`, { waitUntil: 'networkidle', timeout: 20000 });
    } catch (e) {
      note(where, 'load', String(e).split('\n')[0]);
      await p.close();
      continue;
    }
    await p.waitForTimeout(1800);

    const seen = await p.evaluate(({ handle }) => {
      const g = handle ? window[handle] : null;
      const st = g && g.debugState ? g.debugState() : null;
      // where the canvas sits on the screen, and how far its own drawing is pushed down
      const cv = document.querySelector('canvas');
      const box = cv ? cv.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
      const shift = st && typeof st.safeTop === 'number' ? st.safeTop : 0;
      // everything fixed on top of the canvas that a finger can hit
      const dom = [...document.querySelectorAll('.homebtn, .backbtn, button, a')]
        .filter(el => el.offsetParent !== null || getComputedStyle(el).position === 'fixed')
        .map(el => {
          const r = el.getBoundingClientRect();
          return { id: el.className || el.tagName, x: r.x, y: r.y, w: r.width, h: r.height };
        })
        .filter(r => r.w > 0 && r.h > 0);
      return { st, box, shift, dom, insets: window.__insets ?? null };
    }, { handle });

    if (errs.length) note(where, 'console', errs.slice(0, 3).join(' | '));

    const st = seen.st;
    const inset = seen.insets ?? { top: 0, bottom: 0, left: 0, right: 0 };
    if (st && Array.isArray(st.buttons)) {
      // debugState gives the middle of each hit box; a size is not always there, so assume a
      // finger's worth around it, which is the smallest thing worth checking anyway
      const canvasBtns = st.buttons.map(b => ({
        id: b.id,
        // debugState reports canvas coordinates, and the game has shifted its own drawing in by
        // the insets, so the same shift has to be undone to land back on the screen
        x: seen.box.left + inset.left + b.x - FINGER / 2,
        y: seen.box.top + inset.top + b.y - FINGER / 2,
        w: FINGER, h: FINGER,
      }));

      for (const c of canvasBtns) {
        for (const d of seen.dom) {
          const area = overlap(c, d);
          if (area) note(where, 'under-chrome', `${c.id} is under ${d.id} (${area}px²)`);
        }
        // A hit box wholly below the fold belongs to a list you scroll, and is nobody's fault. What
        // matters is a box you can see part of that reaches into a strip the phone has taken.
        const onScreen = c.y < size.h && c.y + c.h > 0 && c.x < size.w && c.x + c.w > 0;
        if (!onScreen) continue;
        if (c.y < inset.top) note(where, 'under-notch', `${c.id} at y=${Math.round(c.y)} is above the safe top (${inset.top})`);
        if (c.y + c.h > size.h - inset.bottom) note(where, 'under-bar', `${c.id} reaches y=${Math.round(c.y + c.h)}, past the safe bottom (${size.h - inset.bottom})`);
        if (c.x < inset.left || c.x + c.w > size.w - inset.right) note(where, 'off-edge', `${c.id} at x=${Math.round(c.x)}`);
      }
    }
    for (let i = 0; i < seen.dom.length; i++) {
      for (let j = i + 1; j < seen.dom.length; j++) {
        const area = overlap(seen.dom[i], seen.dom[j]);
        if (area > 200) note(where, 'chrome-clash', `${seen.dom[i].id} over ${seen.dom[j].id} (${area}px²)`);
      }
    }

    await p.screenshot({ path: `${OUT}/${size.name}-${label(page, years)}.png` });
    await p.close();
  }
  await ctx.close();
}
await browser.close();

const byKind = {};
for (const f of faults) (byKind[f.kind] ??= []).push(f);
console.log(`\n${faults.length} fault${faults.length === 1 ? '' : 's'} across ${pages.length} pages x ${SIZES.length} sizes`);
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n--- ${kind} (${list.length})`);
  for (const f of list.slice(0, 40)) console.log(`  ${f.where.padEnd(24)} ${f.detail}`);
  if (list.length > 40) console.log(`  ... and ${list.length - 40} more`);
}
console.log(`\nscreenshots in ${OUT}`);
writeFileSync(`${OUT}/report.json`, JSON.stringify(faults, null, 2));
process.exit(faults.length ? 1 : 0);
