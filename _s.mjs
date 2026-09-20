import { chromium } from 'playwright';
const B='http://localhost:5180';
const PAGES=['/','/cloudhopper.html','/nightwatch.html','/orbit.html','/mill.html','/tidepool.html','/market.html','/dig.html','/puffball.html'];
const SIZES=[[320,568],[390,844],[430,932],[844,390],[820,1180]];
const NOTCH = ':root{--sat:59px !important;--sab:34px !important;}';
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let bad=0;
for (const notch of [false,true]) for (const [w,h] of SIZES) {
  const pg = await br.newPage({ viewport:{width:w,height:h}, locale:'nl-NL' });
  if (notch) await pg.addInitScript(css => { addEventListener('DOMContentLoaded', () => { const s=document.createElement('style'); s.textContent=css; document.head.appendChild(s); window.dispatchEvent(new Event('resize')); }); }, NOTCH);
  const errs=[]; pg.on('pageerror',e=>errs.push('PAGEERROR '+e.message)); pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  for (const u of PAGES) {
    errs.length=0;
    await pg.goto(B+u,{waitUntil:'networkidle'}); await pg.waitForTimeout(900);
    const over = await pg.evaluate(()=>({ sx: document.body.scrollWidth > window.innerWidth+2 }));
    if (errs.length || over.sx) { bad++; console.log(notch?'notch':'flat', u, w+'x'+h, errs.slice(0,2), over.sx?'H-SCROLL':''); }
  }
  await pg.close();
}
await br.close();
console.log(bad ? bad+' findings' : 'no findings: 9 pages x 5 sizes, with and without a notch');
