import { chromium } from 'playwright';
const B='http://localhost:5180';
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const out=[];
for (const [w,h] of [[390,844],[844,390]]) {
  const pg = await br.newPage({ viewport:{width:w,height:h} });
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message)); pg.on('console',m=>m.type()==='error'&&errs.push(m.text()));
  const tap = async (x,y)=>{ await pg.mouse.move(x,y); await pg.mouse.down(); await pg.waitForTimeout(50); await pg.mouse.up(); await pg.waitForTimeout(120); };

  // --- Puffball: open level 1, drop a puff, let it pop, check a pot went
  await pg.goto(B+'/puffball.html',{waitUntil:'networkidle'}); await pg.waitForTimeout(600);
  let st = await pg.evaluate(()=>window.__puff.debugState());
  await tap(st.buttons.find(b=>b.id==='level:0').x, st.buttons.find(b=>b.id==='level:0').y);
  st = await pg.evaluate(()=>window.__puff.debugState());
  const pots0 = st.potsLeft;
  const drop = st.buttons.find(b=>b.id==='drop');
  await tap(drop.x, drop.y);
  await pg.waitForTimeout(300);
  const pad = st.buttons.find(b=>b.id==='pad:right') || st.buttons.find(b=>b.id.startsWith('pad:'));
  await pg.mouse.move(pad.x,pad.y); await pg.mouse.down(); await pg.waitForTimeout(700); await pg.mouse.up();
  await pg.waitForTimeout(2600);
  const st2 = await pg.evaluate(()=>window.__puff.debugState());
  out.push(`${w}x${h} puffball phase=${st2.phase} lives=${st2.lives} pots ${pots0}->${st2.potsLeft} errors=${errs.length}`);

  // --- the other four: just reach play and confirm a debug handle answers
  for (const [url, handle] of [['/mill.html','__mill'],['/tidepool.html','__tide'],['/market.html','__market'],['/dig.html','__dig']]) {
    errs.length=0;
    await pg.goto(B+url,{waitUntil:'networkidle'}); await pg.waitForTimeout(900);
    const s = await pg.evaluate(hn => { const g = window[hn]; return g && g.debugState ? g.debugState() : null; }, handle);
    if (!s) { out.push(`${w}x${h} ${handle} NO HANDLE`); continue; }
    const btns = s.buttons || s.hits || [];
    const lvl = btns.find(b=>String(b.id).startsWith('level:')) || btns.find(b=>String(b.id).startsWith('site:'));
    if (lvl) await tap(lvl.x, lvl.y);
    await pg.waitForTimeout(700);
    const s2 = await pg.evaluate(hn => window[hn].debugState(), handle);
    out.push(`${w}x${h} ${handle} phase=${s2.phase ?? '-'} errors=${errs.length}${errs.length?' '+errs[0]:''}`);
  }
  await pg.close();
}
await br.close();
console.log(out.join('\n'));
