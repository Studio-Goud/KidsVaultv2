import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/-home-user-KidsVaultv2/2c7558a9-406f-5181-921c-e57081e37e2f/scratchpad/qa3';
const B = 'http://localhost:5180';
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await br.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => m.type()==='error' && errs.push(m.text()));
for (const [url, name, wait] of [['/nightwatch.html','nw',2500], ['/orbit.html','orbit',2000], ['/cloudhopper.html','ch-menu',1500]]) {
  await pg.goto(B + url, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(wait);
  await pg.screenshot({ path: `${OUT}/${name}.png` });
}
// cloudhopper in play, to see the HUD buttons
await pg.evaluate(() => { const s = JSON.parse(localStorage.getItem('cloudhopper.save.v1')||'{}'); s.tutorialSeen = true; localStorage.setItem('cloudhopper.save.v1', JSON.stringify(s)); });
await pg.goto(B + '/cloudhopper.html', { waitUntil: 'networkidle' });
await pg.waitForTimeout(900);
const b = await pg.$$('button');
for (const el of b) { const tx = (await el.innerText()).trim(); if (/islands|eilanden/i.test(tx)) { await el.click(); break; } }
await pg.waitForTimeout(900);
const b2 = await pg.$$('button');
for (const el of b2) { const tx = (await el.innerText()).trim(); if (/^(play|speel|start)/i.test(tx)) { await el.click(); break; } }
await pg.waitForTimeout(2500);
await pg.screenshot({ path: `${OUT}/ch-play.png` });
await br.close();
console.log('ERRORS', errs.length ? errs.slice(0,5) : 'none');
