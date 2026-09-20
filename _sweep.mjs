import { chromium } from 'playwright';
const OUT='/tmp/claude-0/-home-user-KidsVaultv2/2c7558a9-406f-5181-921c-e57081e37e2f/scratchpad/qa3/sweep';
import { mkdirSync } from 'fs'; mkdirSync(OUT, { recursive: true });
const B='http://localhost:5180';
const PAGES=['/','/cloudhopper.html','/nightwatch.html','/orbit.html','/mill.html','/tidepool.html','/market.html','/dig.html','/puffball.html'];
const SIZES=[[320,568],[390,844],[430,932],[844,390],[820,1180]];
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let bad=0;
for (const [w,h] of SIZES) {
  const pg = await br.newPage({ viewport:{width:w,height:h} });
  const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message)); pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  for (const u of PAGES) {
    errs.length = 0;
    await pg.goto(B+u,{waitUntil:'networkidle'}); await pg.waitForTimeout(1300);
    const name = (u === '/' ? 'index' : u.replace('/','').replace('.html',''));
    await pg.screenshot({ path: `${OUT}/${name}__${w}x${h}.png` });
    const over = await pg.evaluate(() => { const b=document.body; return { sx: b.scrollWidth > window.innerWidth + 2, iw: window.innerWidth, sw: b.scrollWidth }; });
    if (errs.length || over.sx) { bad++; console.log(`${name} ${w}x${h}`, errs.slice(0,2), over.sx ? `H-SCROLL ${over.sw}>${over.iw}` : ''); }
  }
  await pg.close();
}
await br.close();
console.log(bad ? `${bad} findings` : 'no findings across 9 pages x 5 sizes');
