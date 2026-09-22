/**
 * Every drawn word in Letterbos on one sheet, at the size the game draws it.
 *
 * A reading game that has to name the picture for you has already failed, and the only way to know
 * whether a drawing names itself is to look at it. Looking at them one at a time, inside the game,
 * is how a knife with its handle drawn twice survived: it was a brown lump on a grey spike and
 * nobody would have guessed the word, and it took a parent to say so.
 *
 * So this lays all seventy-odd of them out side by side, which is the only honest way to review
 * them. Words with a photograph are left out - the photograph is the picture for those.
 *
 *   npm run sheet              every drawn word, at card size
 *   npm run sheet -- mes net   just these, large enough to judge properly
 *
 * It writes to .cache/picturesheet.png, which is gitignored: the sheet is a thing you look at, not
 * a thing the app ships.
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const OUT = '.cache/picturesheet.png';
const picked = process.argv.slice(2).filter(a => !a.startsWith('-'));

mkdirSync('.cache', { recursive: true });
await build({
  entryPoints: ['src/games/letters/pictures.ts'],
  bundle: true, format: 'iife', globalName: 'PICS',
  outfile: '.cache/pictures.bundle.js', logLevel: 'error',
});
const bundle = readFileSync('.cache/pictures.bundle.js', 'utf8');

// the words that kept their drawing; the photographed ones are not this file's business
const plan = JSON.parse(readFileSync('public/letters/photos.json', 'utf8'));
const drawn = plan.words.filter(w => w.a === 'drawn').map(w => w.w);
const words = picked.length ? picked : drawn;

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ deviceScaleFactor: 2 })).newPage();
await page.setContent('<body style="margin:0"></body>');
await page.addScriptTag({ content: bundle });

const result = await page.evaluate(({ words, big }) => {
  const CELL = big ? 230 : 110, COLS = big ? Math.min(5, words.length) : 10, LABEL = big ? 28 : 20;
  const have = words.filter(w => PICS.hasPicture(w));
  const missing = words.filter(w => !PICS.hasPicture(w));
  const rows = Math.ceil(have.length / COLS);
  const c = document.createElement('canvas');
  c.width = COLS * CELL;
  c.height = rows * (CELL + LABEL);
  document.body.appendChild(c);
  const x = c.getContext('2d');
  x.fillStyle = '#eef1f4';
  x.fillRect(0, 0, c.width, c.height);
  const inset = big ? 14 : 6;
  have.forEach((w, i) => {
    const cx = (i % COLS) * CELL, cy = Math.floor(i / COLS) * (CELL + LABEL);
    x.fillStyle = '#e3edd6';                       // the card the game draws them on
    x.beginPath();
    x.roundRect(cx + inset / 2, cy + inset / 2, CELL - inset, CELL - inset, big ? 18 : 10);
    x.fill();
    PICS.drawPicture(x, w, cx + inset + 4, cy + inset + 4, CELL - inset * 2 - 8, CELL - inset * 2 - 8);
    x.fillStyle = '#20303a';
    x.font = big ? '700 18px sans-serif' : '600 13px sans-serif';
    x.textAlign = 'center';
    x.fillText(w, cx + CELL / 2, cy + CELL + (big ? 18 : 13));
  });
  return { url: c.toDataURL('image/png'), shown: have.length, missing };
}, { words, big: picked.length > 0 });

writeFileSync(OUT, Buffer.from(result.url.split(',')[1], 'base64'));
console.log(`${result.shown} drawing${result.shown === 1 ? '' : 's'} -> ${OUT}`);
if (result.missing.length) console.log('no drawing for:', result.missing.join(', '));
await browser.close();
