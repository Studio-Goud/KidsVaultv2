/**
 * Lay the audit's screenshots out side by side, so a person can look at a whole size at once.
 *
 * The audit can prove that nothing pressable is hidden or off the edge. It cannot see a screen
 * that is simply empty, a heading in the wrong place, or a rocket with nowhere to stand. Those
 * still need eyes, and eyes are much better at seventeen small pictures in a row than at
 * seventeen big ones one after another.
 *
 *   npm run contact           every size
 *   npm run contact -- notch  one size
 */
import { chromium } from 'playwright';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = '.cache/audit';
const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
const files = readdirSync(DIR).filter(f => f.endsWith('.png'));
const sizes = [...new Set(files.map(f => f.split('-')[0]))].filter(s => !want.length || want.includes(s));

const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await (await browser.newContext({ deviceScaleFactor: 1 })).newPage();
await page.setContent('<body style="margin:0"></body>');

for (const size of sizes) {
  const shots = files.filter(f => f.startsWith(size + '-')).sort();
  const data = shots.map(f => ({
    name: f.slice(size.length + 1, -4),
    src: 'data:image/png;base64,' + readFileSync(`${DIR}/${f}`).toString('base64'),
  }));
  const url = await page.evaluate(async ({ data, size }) => {
    const CELL = 300, COLS = 6, LABEL = 20;
    const imgs = await Promise.all(data.map(async d => {
      const i = new Image(); i.src = d.src; await i.decode(); return { ...d, i };
    }));
    const rows = Math.ceil(imgs.length / COLS);
    const tall = Math.max(...imgs.map(x => x.i.height / x.i.width));
    const cellH = Math.min(CELL * 1.9, CELL * tall);
    const c = document.createElement('canvas');
    c.width = COLS * CELL; c.height = rows * (cellH + LABEL);
    document.body.appendChild(c);
    const x = c.getContext('2d');
    x.fillStyle = '#2b303a'; x.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, k) => {
      const cx = (k % COLS) * CELL, cy = Math.floor(k / COLS) * (cellH + LABEL);
      const s = Math.min((CELL - 10) / im.i.width, (cellH - 8) / im.i.height);
      const w = im.i.width * s, h = im.i.height * s;
      x.drawImage(im.i, cx + (CELL - w) / 2, cy + 4, w, h);
      x.fillStyle = '#cdd4de'; x.font = '600 13px sans-serif'; x.textAlign = 'center';
      x.fillText(im.name, cx + CELL / 2, cy + cellH + 15);
    });
    return c.toDataURL('image/png');
  }, { data, size });
  writeFileSync(`${DIR}/sheet-${size}.png`, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${size}: ${shots.length} screens -> ${DIR}/sheet-${size}.png`);
}
await browser.close();
